/*
 * ⚠ このファイルはホットパス(毎フレーム呼ばれる kernel)なので、リポジトリ規約の例外として
 * `for` / `let` を使う(eslint.config.js で本ファイルだけ functional/no-let と no-loop-statements を off)。
 *
 * 理由(2026-09-20 実測): `Array.from` + `reduce` の書き方は 1 サンプルごとに累積オブジェクトと配列を作り、
 * 101 サンプル × 19 セグメントで呼び出しごとに約 200 KB の割り当てになった。さらに、TurboFan が inline しない
 * 関数呼び出しに double を引数で渡すと 1 個 16 バイトの HeapNumber になる(13 個で 211 バイト / 呼び出し)ので、
 * 「小さなヘルパに数値を渡す」形も割り当てになる。よって本ファイルの kernel は
 *   - 数値計算をループ本体に展開する(computed double を多数渡す小関数を作らない)
 *   - フェーズ間の一時値は factory が確保した Float64Array に置く
 *   - 呼び出しごとに新しい配列・オブジェクト・クロージャを作らない(例外経路の Error を除く)
 * という方針で書く。TypedArray と整数 index だけを受ける補助関数は可。
 * また `Math.hypot` は V8 で呼び出しごとに割り当てる(2026-09-20 実測: 3 引数で約 116 バイト)ので、`Math.sqrt(x*x + y*y + z*z)` を使う。
 */
import type { BezierPath, Point3D } from './types'
import { DEFAULT_ARC_LENGTH_SAMPLES, assertArcLengthSamples } from './segment'
import { readFrenetFrame, type FrenetFrame } from './frenet'

/**
 * `Float32Array` に interleave 格納するときの 1 フレームあたり float 数。
 *
 * レイアウト: `[px, py, pz, tx, ty, tz, nx, ny, nz, bx, by, bz]`。
 * {@link FRENET_STRIDE} と同じ値・同じレイアウト(名前だけ実態に合わせた)。メジャーバージョン内は stable。
 */
export const RMF_STRIDE = 12

/**
 * `Float32Array` 内の各成分のオフセット(stride 内の index)。{@link FRENET_OFFSET} と同じ値。
 */
export const RMF_OFFSET = {
  POSITION: 0,
  TANGENT: 3,
  NORMAL: 6,
  BINORMAL: 9,
} as const

/** 1 セグメントの制御点 12 float のレイアウト(`writeCatmullRomSegments` の出力と同じ: start, cp1, cp2, end の xyz)。 */
const SEGMENT_STRIDE = 12

/**
 * 1 フレーム分の読み取り用オブジェクト。{@link FrenetFrame} と同じ形(名前だけ実態に合わせた)。
 *
 * `normal` は曲率方向(Frenet の法線)ではなく、曲線に沿って捩れが最小になるように運んだ法線
 * (rotation-minimizing frame / Bishop frame)。
 */
export type RotationMinimizingFrame = FrenetFrame

/**
 * サンプル点の取り方。
 *
 * - `'arc-length'`(既定): 曲線に沿った距離で等間隔。セグメントごとの累積弧長表を引いて `t` を求める
 * - `'segment-t'`: セグメントの選択は弧長比例、セグメントの中は距離比率をそのまま `t` にする(0.2.x の `writeFrenetFrames` と同じ)
 */
export type FrameParameterization = 'arc-length' | 'segment-t'

/**
 * {@link createRotationMinimizingFrameWriter} のオプション。すべて factory で受け取り、write 側には渡さない
 * (write 側に `options = {}` のような既定引数を置くと、それ自体が呼び出しごとの割り当てになるため)。
 */
export type RotationMinimizingFrameWriterOptions = {
  /** 1 回の write で受け付けるセグメント数の上限(1 以上の整数)。scratch の容量になる */
  readonly maxSegments: number
  /** 出力するサンプル点数(2 以上の整数)。`out` の長さは `samples * RMF_STRIDE` 以上 */
  readonly samples: number
  /** セグメント長を測る分割数(1 以上の整数、既定 64)。`'arc-length'` の表の解像度でもある */
  readonly arcLengthSamples?: number
  /** サンプル点の取り方(既定 `'arc-length'`) */
  readonly parameterization?: FrameParameterization
  /**
   * 退化(全長ゼロ、接線ゼロ、初期法線が接線と平行)のとき throw するか。既定 `false` = 決定的なフォールバックで
   * 直交基底を出し続ける(リアルタイム用途でフレームが止まらないように)。`true` = `Error` を投げる
   */
  readonly strict?: boolean
}

/**
 * {@link createRotationMinimizingFrameWriter} の返却値。
 *
 * `writePath` / `writeSegments` は結果を返さず、渡された `out` に書き込む。どちらも factory 初期化後の正常系では
 * ライブラリ側で新しいオブジェクト・配列・クロージャを作らない(例外経路の `Error` と、呼び出し側の入出力バッファは除く)。
 */
export type RotationMinimizingFrameWriter = {
  /** 出力サンプル数(factory に渡した値) */
  readonly samples: number
  /** セグメント数の上限(factory に渡した値) */
  readonly maxSegments: number
  /**
   * `BezierPath<Point3D>` からフレームを書く。
   *
   * @param out 出力バッファ(長さ `samples * RMF_STRIDE` 以上)
   * @param path 3D ベジェパス(セグメント数は 1 〜 `maxSegments`)
   * @param initialNormal 先頭フレームの法線の希望(xyz、3 要素以上)。接線に直交する成分を正規化して使う。
   *   毎フレーム形が変わる曲線では、前フレームの法線を渡すとフレーム間の急な回転を避けられる。省略時は接線の最小成分軸から決める
   */
  readonly writePath: (out: Float32Array, path: BezierPath<Point3D>, initialNormal?: ArrayLike<number>) => void
  /**
   * `writeCatmullRomSegments` の出力(セグメントごとに start / cp1 / cp2 / end の xyz = 12 float)からフレームを書く。
   * `BezierPath` を経由しない。
   *
   * @param out 出力バッファ(長さ `samples * RMF_STRIDE` 以上)
   * @param segments セグメントの数値列(長さ `segmentCount * 12` 以上)
   * @param segmentCount セグメント数(1 〜 `maxSegments`)
   * @param initialNormal `writePath` と同じ
   */
  readonly writeSegments: (
    out: Float32Array,
    segments: Float32Array,
    segmentCount: number,
    initialNormal?: ArrayLike<number>,
  ) => void
}

/** 単位ベクトル同士の比較に使う絶対閾値(長さの 2 乗) */
const DIR_EPS2 = 1e-18
/** initialNormal が接線と平行かの判定(直交化後の残差の 2 乗 ÷ 元の長さの 2 乗) */
const PARALLEL_EPS_REL2 = 1e-12
/**
 * 長さの閾値はスケール相対で決める(スケール不変)。
 * - 隣接サンプルの一致判定: 平均のサンプル間隔(全長 ÷ (samples − 1))に対する相対
 * - 接線ゼロの判定: **そのセグメント**の長さに対する相対(全長相対だと、長いセグメントの後の短いセグメントで正しい接線を潰す)
 */
const LEN_EPS_REL = 1e-9

const assertPositiveInteger = (value: number, name: string, min: number): void => {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new RangeError(
      `createRotationMinimizingFrameWriter: ${name} must be an integer >= ${String(min)} (got ${String(value)})`,
    )
  }
}

/**
 * 捩れを最小にするフレーム(rotation-minimizing frame)を `Float32Array` に書く writer を作る。
 *
 * ## 何をするか
 * 3D ベジェパスに沿って `samples` 個の点を取り、各点の位置・接線・法線・従法線(各 xyz、計 12 float)を
 * `out` に interleave で書く。法線は Wang らの **double reflection 法**(隣接する 2 点の位置差で 1 回、接線差で 1 回反射。
 * 滑らかで正則な曲線に対して離散 RMF として 4 次精度)で運ぶ。0.2.x の `writeFrenetFrames`(接線間の最小回転、2 次精度)より捩れの累積が小さい。
 *
 * ## なぜ factory か
 * 形が毎フレーム変わる曲線では事前計算する形が無いが、**容量と作業領域は先に確保できる**。この factory は
 * セグメントの制御点・弧長表・位置と接線の作業領域を `Float64Array` で 1 回だけ確保し、返す関数はそれを使い回す。
 * 返す関数は正常系でライブラリ側の新しい割り当てを行わない(詳細は {@link RotationMinimizingFrameWriter})。
 *
 * ## 使い方
 * ```ts
 * const writer = createRotationMinimizingFrameWriter({ maxSegments: 19, samples: 101 })
 * const frames = new Float32Array(101 * RMF_STRIDE)
 * // 毎フレーム
 * writer.writeSegments(frames, segments, 19, previousNormal)
 * ```
 *
 * ## 退化の扱い(`strict: false` 既定)
 * - 全長ゼロ: 位置は先頭点、フレームは (T, N, B) = (+z, +x, +y)
 * - 接線ゼロ(cusp、重複した制御点): 直前のサンプルの接線を引き継ぐ(先頭なら少し先の `t` の接線、それもゼロなら +z)
 * - 隣接サンプルが同じ位置: 位置差の反射を省き、接線間の最小回転で運ぶ。接線が反平行なら前の法線を新しい接線に直交化して使う
 * - 初期法線が接線と平行: 接線の最小成分軸から法線を作る
 * `strict: true` ではこれらで `Error` を投げる。
 *
 * ## 契約と検証
 * `segmentCount > maxSegments`、`out` / `segments` の長さ不足、非有限の座標は毎回検査して `RangeError`。
 * 割り当てゼロは言語仕様の契約にはならない(エンジンの inline 判定に依存する)ので、V8(Node 22)では既定と
 * `--no-turbo-inlining` の両方で、warm-up 後の 10 万回の呼び出しの間に young generation の GC(Scavenge)が 1 回も起きないことを
 * `scripts/alloc-probe.mjs`(`pnpm bench:alloc`)で確かめている。他のエンジンでは未測定。
 *
 * @param options 容量・サンプル数・精度・退化時の方針
 * @throws 引数が範囲外のとき `RangeError`
 */
export const createRotationMinimizingFrameWriter = (
  options: RotationMinimizingFrameWriterOptions,
): RotationMinimizingFrameWriter => {
  const { maxSegments, samples } = options
  const arcSamples = options.arcLengthSamples ?? DEFAULT_ARC_LENGTH_SAMPLES
  const parameterization = options.parameterization ?? 'arc-length'
  if (parameterization !== 'arc-length' && parameterization !== 'segment-t') {
    throw new RangeError(
      `createRotationMinimizingFrameWriter: parameterization must be 'arc-length' or 'segment-t' (got ${String(parameterization)})`,
    )
  }
  const useArcLength = parameterization === 'arc-length'
  const strict = options.strict ?? false
  assertPositiveInteger(maxSegments, 'maxSegments', 1)
  assertPositiveInteger(samples, 'samples', 2)
  assertArcLengthSamples(arcSamples, 'createRotationMinimizingFrameWriter')

  const knots = arcSamples + 1
  // scratch(factory で 1 回だけ確保し、毎回上書きする)
  const cp = new Float64Array(maxSegments * SEGMENT_STRIDE)
  const table = new Float64Array(maxSegments * knots)
  const cumulative = new Float64Array(maxSegments)
  const posTan = new Float64Array(samples * 6)

  const assertFinite = (segmentCount: number, where: string): void => {
    const n = segmentCount * SEGMENT_STRIDE
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(cp[i]!)) throw new RangeError(`${where}: control points must be finite (index ${String(i)})`)
    }
  }

  const loadPath = (path: BezierPath<Point3D>): number => {
    const segmentCount = path.segments.length
    if (segmentCount < 1 || segmentCount > maxSegments) {
      throw new RangeError(`writePath: path must have 1..${String(maxSegments)} segments (got ${String(segmentCount)})`)
    }
    let sx = path.start.x
    let sy = path.start.y
    let sz = path.start.z
    for (let s = 0; s < segmentCount; s++) {
      const seg = path.segments[s]!
      const base = s * SEGMENT_STRIDE
      cp[base] = sx
      cp[base + 1] = sy
      cp[base + 2] = sz
      cp[base + 3] = seg.cp1.x
      cp[base + 4] = seg.cp1.y
      cp[base + 5] = seg.cp1.z
      cp[base + 6] = seg.cp2.x
      cp[base + 7] = seg.cp2.y
      cp[base + 8] = seg.cp2.z
      cp[base + 9] = seg.end.x
      cp[base + 10] = seg.end.y
      cp[base + 11] = seg.end.z
      sx = seg.end.x
      sy = seg.end.y
      sz = seg.end.z
    }
    assertFinite(segmentCount, 'writePath')
    return segmentCount
  }

  const loadSegments = (segments: Float32Array, segmentCount: number): void => {
    if (!Number.isSafeInteger(segmentCount) || segmentCount < 1 || segmentCount > maxSegments) {
      throw new RangeError(
        `writeSegments: segmentCount must be 1..${String(maxSegments)} (got ${String(segmentCount)})`,
      )
    }
    const needed = segmentCount * SEGMENT_STRIDE
    if (segments.length < needed) {
      throw new RangeError(
        `writeSegments: segments must have at least ${String(needed)} floats (got ${String(segments.length)})`,
      )
    }
    for (let i = 0; i < needed; i++) cp[i] = segments[i]!
    assertFinite(segmentCount, 'writeSegments')
  }

  /**
   * kernel 本体。`cp[0 .. segmentCount * 12)` に制御点が入っている前提で、`out` に `samples` フレームを書く。
   * ループ本体に数値計算を展開してある(ファイル冒頭の方針を参照)。
   */
  const write = (out: Float32Array, segmentCount: number, initialNormal: ArrayLike<number> | undefined): void => {
    if (out.length < samples * RMF_STRIDE) {
      throw new RangeError(
        `write: out must have at least ${String(samples * RMF_STRIDE)} floats (got ${String(out.length)})`,
      )
    }
    if (initialNormal !== undefined && initialNormal.length < 3) {
      throw new RangeError('write: initialNormal must have at least 3 components')
    }

    // ---- 1. セグメントごとの累積弧長表と全体の累積長 ----
    let total = 0
    for (let s = 0; s < segmentCount; s++) {
      const base = s * SEGMENT_STRIDE
      const row = s * knots
      const p0x = cp[base]!
      const p0y = cp[base + 1]!
      const p0z = cp[base + 2]!
      const p1x = cp[base + 3]!
      const p1y = cp[base + 4]!
      const p1z = cp[base + 5]!
      const p2x = cp[base + 6]!
      const p2y = cp[base + 7]!
      const p2z = cp[base + 8]!
      const p3x = cp[base + 9]!
      const p3y = cp[base + 10]!
      const p3z = cp[base + 11]!
      let prevX = p0x
      let prevY = p0y
      let prevZ = p0z
      let acc = 0
      table[row] = 0
      for (let k = 1; k <= arcSamples; k++) {
        const t = k / arcSamples
        const mt = 1 - t
        const mt2 = mt * mt
        const mt3 = mt2 * mt
        const t2 = t * t
        const t3 = t2 * t
        const x = mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x
        const y = mt3 * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3 * p3y
        const z = mt3 * p0z + 3 * mt2 * t * p1z + 3 * mt * t2 * p2z + t3 * p3z
        // ⚠ Math.hypot は V8(Node 22)で呼び出しごとに割り当てる(実測 約 116 バイト / 回)ので使わない
        const ex = x - prevX
        const ey = y - prevY
        const ez = z - prevZ
        acc += Math.sqrt(ex * ex + ey * ey + ez * ez)
        table[row + k] = acc
        prevX = x
        prevY = y
        prevZ = z
      }
      if (acc <= 0) {
        // 折れ線長がゼロでも制御多角形が潰れていなければ非自明な曲線(例: arcLengthSamples が小さく、始点と終点が同じ cubic)。
        // 制御多角形の長さ(真の弧長の上界)を長さとみなし、表は線形にしておく。全長ゼロは「制御点がすべて同一点」のときだけ
        const q1x = p1x - p0x
        const q1y = p1y - p0y
        const q1z = p1z - p0z
        const q2x = p2x - p1x
        const q2y = p2y - p1y
        const q2z = p2z - p1z
        const q3x = p3x - p2x
        const q3y = p3y - p2y
        const q3z = p3z - p2z
        const poly =
          Math.sqrt(q1x * q1x + q1y * q1y + q1z * q1z) +
          Math.sqrt(q2x * q2x + q2y * q2y + q2z * q2z) +
          Math.sqrt(q3x * q3x + q3y * q3y + q3z * q3z)
        if (poly > 0) {
          acc = poly
          for (let k = 1; k <= arcSamples; k++) table[row + k] = (poly * k) / arcSamples
        }
      }
      total += acc
      cumulative[s] = total
    }

    // 隣接サンプルの一致判定(位置差の 2 乗)は平均サンプル間隔に対する相対
    const posEps = (total / (samples - 1)) * LEN_EPS_REL
    const posEps2 = posEps * posEps

    // ---- 全長ゼロ: 位置は先頭点、フレームは固定の直交基底 ----
    if (total <= 0) {
      if (strict) throw new Error('write: path has zero length')
      const px = cp[0]!
      const py = cp[1]!
      const pz = cp[2]!
      for (let i = 0; i < samples; i++) {
        const o = i * RMF_STRIDE
        out[o] = px
        out[o + 1] = py
        out[o + 2] = pz
        out[o + 3] = 0
        out[o + 4] = 0
        out[o + 5] = 1
        out[o + 6] = 1
        out[o + 7] = 0
        out[o + 8] = 0
        out[o + 9] = 0
        out[o + 10] = 1
        out[o + 11] = 0
      }
      return
    }

    // ---- 2. 各サンプルの位置と単位接線(double の posTan に置き、out にも書く) ----
    const lastSample = samples - 1
    for (let i = 0; i < samples; i++) {
      // 2a. セグメントと t を決める
      let seg: number
      let t: number
      if (i === 0) {
        seg = 0
        t = 0
      } else if (i === lastSample) {
        seg = segmentCount - 1
        t = 1
      } else {
        const target = (i / lastSample) * total
        // cumulative の lower bound(target 以上になる最初のセグメント)
        let lo = 0
        let hi = segmentCount
        while (lo < hi) {
          const mid = (lo + hi) >>> 1
          if (cumulative[mid]! < target) lo = mid + 1
          else hi = mid
        }
        seg = lo >= segmentCount ? segmentCount - 1 : lo
        const segStart = seg > 0 ? cumulative[seg - 1]! : 0
        const segLen = cumulative[seg]! - segStart
        const localLen = target - segStart
        if (segLen <= 0 || localLen <= 0) {
          t = 0
        } else if (localLen >= segLen) {
          t = 1
        } else if (useArcLength) {
          // 2b. セグメントの表を lower bound で引き、区間内は線形補間
          const row = seg * knots
          let klo = 1
          let khi = arcSamples
          while (klo < khi) {
            const kmid = (klo + khi) >>> 1
            if (table[row + kmid]! < localLen) klo = kmid + 1
            else khi = kmid
          }
          const l0 = table[row + klo - 1]!
          const l1 = table[row + klo]!
          const frac = l1 > l0 ? (localLen - l0) / (l1 - l0) : 0
          t = (klo - 1 + frac) / arcSamples
        } else {
          t = localLen / segLen
        }
      }

      // 2c. 位置と微分
      const base = seg * SEGMENT_STRIDE
      const p0x = cp[base]!
      const p0y = cp[base + 1]!
      const p0z = cp[base + 2]!
      const p1x = cp[base + 3]!
      const p1y = cp[base + 4]!
      const p1z = cp[base + 5]!
      const p2x = cp[base + 6]!
      const p2y = cp[base + 7]!
      const p2z = cp[base + 8]!
      const p3x = cp[base + 9]!
      const p3y = cp[base + 10]!
      const p3z = cp[base + 11]!
      const mt = 1 - t
      const mt2 = mt * mt
      const mt3 = mt2 * mt
      const t2 = t * t
      const t3 = t2 * t
      const px = mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x
      const py = mt3 * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3 * p3y
      const pz = mt3 * p0z + 3 * mt2 * t * p1z + 3 * mt * t2 * p2z + t3 * p3z
      const c0 = 3 * mt2
      const c1 = 6 * mt * t
      const c2 = 3 * t2
      let dx = c0 * (p1x - p0x) + c1 * (p2x - p1x) + c2 * (p3x - p2x)
      let dy = c0 * (p1y - p0y) + c1 * (p2y - p1y) + c2 * (p3y - p2y)
      let dz = c0 * (p1z - p0z) + c1 * (p2z - p1z) + c2 * (p3z - p2z)
      let dd = dx * dx + dy * dy + dz * dz

      // 2d. 接線ゼロ(cusp、重複制御点)のフォールバック。閾値はそのセグメントの長さに対する相対
      const segLength = table[seg * knots + arcSamples]!
      const tanEps = segLength * LEN_EPS_REL
      if (dd <= tanEps * tanEps) {
        if (strict) throw new Error(`write: zero tangent at sample ${String(i)}`)
        if (i > 0) {
          const pi = (i - 1) * 6
          dx = posTan[pi + 3]!
          dy = posTan[pi + 4]!
          dz = posTan[pi + 5]!
        } else {
          // 先頭: 少し先の t の微分を使う。それもゼロなら +z
          const te = 1e-4
          const me = 1 - te
          const e0 = 3 * me * me
          const e1 = 6 * me * te
          const e2 = 3 * te * te
          dx = e0 * (p1x - p0x) + e1 * (p2x - p1x) + e2 * (p3x - p2x)
          dy = e0 * (p1y - p0y) + e1 * (p2y - p1y) + e2 * (p3y - p2y)
          dz = e0 * (p1z - p0z) + e1 * (p2z - p1z) + e2 * (p3z - p2z)
          if (dx * dx + dy * dy + dz * dz <= tanEps * tanEps) {
            dx = 0
            dy = 0
            dz = 1
          }
        }
        dd = dx * dx + dy * dy + dz * dz
      }
      const inv = 1 / Math.sqrt(dd)
      const tx = dx * inv
      const ty = dy * inv
      const tz = dz * inv

      const pi = i * 6
      posTan[pi] = px
      posTan[pi + 1] = py
      posTan[pi + 2] = pz
      posTan[pi + 3] = tx
      posTan[pi + 4] = ty
      posTan[pi + 5] = tz
      const o = i * RMF_STRIDE
      out[o] = px
      out[o + 1] = py
      out[o + 2] = pz
      out[o + 3] = tx
      out[o + 4] = ty
      out[o + 5] = tz
    }

    // ---- 3. 先頭フレームの法線 ----
    let rx = 0
    let ry = 0
    let rz = 0
    {
      const t0x = posTan[3]!
      const t0y = posTan[4]!
      const t0z = posTan[5]!
      let ok = false
      if (initialNormal !== undefined) {
        const gx = Number(initialNormal[0])
        const gy = Number(initialNormal[1])
        const gz = Number(initialNormal[2])
        const dot = gx * t0x + gy * t0y + gz * t0z
        rx = gx - dot * t0x
        ry = gy - dot * t0y
        rz = gz - dot * t0z
        const rr = rx * rx + ry * ry + rz * rz
        const gg = gx * gx + gy * gy + gz * gz
        // 「平行」は与えたベクトルの大きさに対する相対で判定する(残差の比 1e-12 = 角度 約 1e-6 rad 未満)。
        // Float32 に丸めた接線をそのまま渡されても平行と判定できるように、絶対閾値にはしない
        if (Number.isFinite(rr) && gg > 0 && rr > PARALLEL_EPS_REL2 * gg) {
          const inv = 1 / Math.sqrt(rr)
          rx *= inv
          ry *= inv
          rz *= inv
          ok = true
        } else if (strict) {
          throw new Error('write: initialNormal is parallel to the first tangent (or not finite)')
        }
      }
      if (!ok) {
        // 接線の最小成分の軸を helper にして N = normalize(T × helper)
        const ax = Math.abs(t0x)
        const ay = Math.abs(t0y)
        const az = Math.abs(t0z)
        const hx = ax <= ay && ax <= az ? 1 : 0
        const hy = ax <= ay && ax <= az ? 0 : ay <= az ? 1 : 0
        const hz = ax <= ay && ax <= az ? 0 : ay <= az ? 0 : 1
        rx = t0y * hz - t0z * hy
        ry = t0z * hx - t0x * hz
        rz = t0x * hy - t0y * hx
        const inv = 1 / Math.sqrt(rx * rx + ry * ry + rz * rz)
        rx *= inv
        ry *= inv
        rz *= inv
      }
      out[RMF_OFFSET.NORMAL] = rx
      out[RMF_OFFSET.NORMAL + 1] = ry
      out[RMF_OFFSET.NORMAL + 2] = rz
      out[RMF_OFFSET.BINORMAL] = t0y * rz - t0z * ry
      out[RMF_OFFSET.BINORMAL + 1] = t0z * rx - t0x * rz
      out[RMF_OFFSET.BINORMAL + 2] = t0x * ry - t0y * rx
    }

    // ---- 4. double reflection で法線を運ぶ(Wang et al. 2008) ----
    for (let i = 1; i < samples; i++) {
      const pp = (i - 1) * 6
      const pc = i * 6
      const x0 = posTan[pp]!
      const y0 = posTan[pp + 1]!
      const z0 = posTan[pp + 2]!
      const t0x = posTan[pp + 3]!
      const t0y = posTan[pp + 4]!
      const t0z = posTan[pp + 5]!
      const x1 = posTan[pc]!
      const y1 = posTan[pc + 1]!
      const z1 = posTan[pc + 2]!
      const t1x = posTan[pc + 3]!
      const t1y = posTan[pc + 4]!
      const t1z = posTan[pc + 5]!

      const v1x = x1 - x0
      const v1y = y1 - y0
      const v1z = z1 - z0
      const c1 = v1x * v1x + v1y * v1y + v1z * v1z

      let nx: number
      let ny: number
      let nz: number
      if (c1 > posEps2) {
        // 反射 1: 位置差 v1 を法線とする平面で r と t0 を反射
        const k1 = (2 * (v1x * rx + v1y * ry + v1z * rz)) / c1
        const rLx = rx - k1 * v1x
        const rLy = ry - k1 * v1y
        const rLz = rz - k1 * v1z
        const k1t = (2 * (v1x * t0x + v1y * t0y + v1z * t0z)) / c1
        const tLx = t0x - k1t * v1x
        const tLy = t0y - k1t * v1y
        const tLz = t0z - k1t * v1z
        // 反射 2: 接線差 v2 を法線とする平面で rL を反射
        const v2x = t1x - tLx
        const v2y = t1y - tLy
        const v2z = t1z - tLz
        const c2 = v2x * v2x + v2y * v2y + v2z * v2z
        if (c2 > DIR_EPS2) {
          const k2 = (2 * (v2x * rLx + v2y * rLy + v2z * rLz)) / c2
          nx = rLx - k2 * v2x
          ny = rLy - k2 * v2y
          nz = rLz - k2 * v2z
        } else {
          nx = rLx
          ny = rLy
          nz = rLz
        }
      } else {
        // 隣接サンプルが同じ位置: 接線間の最小回転(接線の和を法線とする平面での 1 回の反射)
        if (strict) throw new Error(`write: coincident samples at ${String(i - 1)} and ${String(i)}`)
        const mx = t0x + t1x
        const my = t0y + t1y
        const mz = t0z + t1z
        const mm = mx * mx + my * my + mz * mz
        if (mm > DIR_EPS2) {
          const km = (2 * (mx * rx + my * ry + mz * rz)) / mm
          nx = rx - km * mx
          ny = ry - km * my
          nz = rz - km * mz
        } else {
          nx = rx
          ny = ry
          nz = rz
        }
      }

      // 直交化(t1 成分を除く)と正規化。潰れたら前の法線を t1 に直交化、それも潰れたら helper 軸
      {
        const d = nx * t1x + ny * t1y + nz * t1z
        nx -= d * t1x
        ny -= d * t1y
        nz -= d * t1z
        let nn = nx * nx + ny * ny + nz * nz
        if (nn <= DIR_EPS2) {
          const dr = rx * t1x + ry * t1y + rz * t1z
          nx = rx - dr * t1x
          ny = ry - dr * t1y
          nz = rz - dr * t1z
          nn = nx * nx + ny * ny + nz * nz
          if (nn <= DIR_EPS2) {
            if (strict) throw new Error(`write: degenerate normal at sample ${String(i)}`)
            const ax = Math.abs(t1x)
            const ay = Math.abs(t1y)
            const az = Math.abs(t1z)
            const hx = ax <= ay && ax <= az ? 1 : 0
            const hy = ax <= ay && ax <= az ? 0 : ay <= az ? 1 : 0
            const hz = ax <= ay && ax <= az ? 0 : ay <= az ? 0 : 1
            nx = t1y * hz - t1z * hy
            ny = t1z * hx - t1x * hz
            nz = t1x * hy - t1y * hx
            nn = nx * nx + ny * ny + nz * nz
          }
        }
        const inv = 1 / Math.sqrt(nn)
        nx *= inv
        ny *= inv
        nz *= inv
      }

      const o = i * RMF_STRIDE
      out[o + RMF_OFFSET.NORMAL] = nx
      out[o + RMF_OFFSET.NORMAL + 1] = ny
      out[o + RMF_OFFSET.NORMAL + 2] = nz
      out[o + RMF_OFFSET.BINORMAL] = t1y * nz - t1z * ny
      out[o + RMF_OFFSET.BINORMAL + 1] = t1z * nx - t1x * nz
      out[o + RMF_OFFSET.BINORMAL + 2] = t1x * ny - t1y * nx
      rx = nx
      ry = ny
      rz = nz
    }
  }

  return {
    samples,
    maxSegments,
    writePath: (out, path, initialNormal) => {
      const segmentCount = loadPath(path)
      write(out, segmentCount, initialNormal)
    },
    writeSegments: (out, segments, segmentCount, initialNormal) => {
      loadSegments(segments, segmentCount)
      write(out, segmentCount, initialNormal)
    },
  }
}

/**
 * `Float32Array` から 1 フレーム分を読み出して {@link RotationMinimizingFrame} オブジェクトを返す。
 * テスト / デバッグ / 単発利用向け({@link readFrenetFrame} と同じ)。ホットパスでは `out` を
 * {@link RMF_STRIDE} / {@link RMF_OFFSET} で直接読むこと。
 */
export const readRotationMinimizingFrame = (frames: Float32Array, frameIdx: number): RotationMinimizingFrame =>
  readFrenetFrame(frames, frameIdx)

/**
 * デバッグ・単発利用向け: writer を都度作ってフレームをオブジェクト配列で返す(割り当てあり)。
 * 毎フレーム呼ぶ用途では {@link createRotationMinimizingFrameWriter} を 1 回作って使い回すこと。
 *
 * @param path 3D ベジェパス
 * @param samples サンプル点数(2 以上)
 * @param options `maxSegments` / `samples` 以外の writer オプション
 */
export const computeRotationMinimizingFrames = (
  path: BezierPath<Point3D>,
  samples: number,
  options: Omit<RotationMinimizingFrameWriterOptions, 'maxSegments' | 'samples'> = {},
): readonly RotationMinimizingFrame[] => {
  const writer = createRotationMinimizingFrameWriter({
    ...options,
    maxSegments: Math.max(1, path.segments.length),
    samples,
  })
  const out = new Float32Array(samples * RMF_STRIDE)
  writer.writePath(out, path)
  return Array.from({ length: samples }, (_, i) => readFrenetFrame(out, i))
}
