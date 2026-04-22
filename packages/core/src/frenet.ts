import type { BezierPath, Point3D } from './types'

/**
 * パス上の 1 点の Frenet フレーム(平行輸送法で計算した (T, N, B) 直交基底 + 位置)。
 *
 * 読み取り用 / テスト用の型。ホットパスでは {@link writeFrenetFrames} で
 * `Float32Array` に直接書き込み、{@link FRENET_STRIDE} / {@link FRENET_OFFSET}
 * を使って直読みすること(オブジェクト生成なし)。
 */
export type FrenetFrame = {
  /** サンプル点の 3D 位置 */
  readonly position: Point3D
  /** 接線(正規化済み) */
  readonly tangent: Point3D
  /** 法線(正規化済み、double-reflection で twist 最小化) */
  readonly normal: Point3D
  /** 従法線(= T × N、正規化済み) */
  readonly binormal: Point3D
}

/**
 * Float32Array に interleave 格納するときの 1 フレームあたり float 数。
 *
 * レイアウト: `[px, py, pz, tx, ty, tz, nx, ny, nz, bx, by, bz]`
 *
 * メジャーバージョン内は stable。ストライドやレイアウト変更は SemVer major として扱う。
 */
export const FRENET_STRIDE = 12

/**
 * Float32Array 内の各成分のオフセット(stride 内の index)。
 *
 * `frames[frameIdx * FRENET_STRIDE + FRENET_OFFSET.TANGENT + 1]` で
 * `frameIdx` 番目のフレームの接線 y 成分が読める。
 *
 * メジャーバージョン内は stable。
 */
export const FRENET_OFFSET = {
  POSITION: 0,
  TANGENT: 3,
  NORMAL: 6,
  BINORMAL: 9,
} as const

/**
 * {@link writeFrenetFrames} / {@link computeFrenetFrames} の精度/速度オプション。
 */
export type FrenetOptions = {
  /**
   * 弧長計算のサンプル数。大きいほど精度が高いが遅くなる。
   * 既定値 `64` は {@link arcLengthTo} のデフォルトと揃えてある。
   */
  readonly arcLengthSamples?: number
}

const DEFAULT_ARC_LENGTH_SAMPLES = 64
const EPS = 1e-9

/**
 * Float32Array の指定オフセットに 3D ベクトルを正規化して書き込む。
 * ゼロベクトル(長さ < EPS)の場合は (0, 0, 0) を書く。
 *
 * `let` を使わず `const` と三項で構成することで、CLAUDE.md の関数型スタイル規約に沿う。
 */
const writeNormalized = (out: Float32Array, offset: number, x: number, y: number, z: number): void => {
  const len = Math.hypot(x, y, z)
  const valid = len >= EPS
  out[offset] = valid ? x / len : 0
  out[offset + 1] = valid ? y / len : 0
  out[offset + 2] = valid ? z / len : 0
}

/** 3 次ベジェの点を計算し、指定オフセットに書き込む。 */
const writePointOnSegment = (
  out: Float32Array,
  offset: number,
  p0x: number,
  p0y: number,
  p0z: number,
  p1x: number,
  p1y: number,
  p1z: number,
  p2x: number,
  p2y: number,
  p2z: number,
  p3x: number,
  p3y: number,
  p3z: number,
  t: number,
): void => {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t
  out[offset] = mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x
  out[offset + 1] = mt3 * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3 * p3y
  out[offset + 2] = mt3 * p0z + 3 * mt2 * t * p1z + 3 * mt * t2 * p2z + t3 * p3z
}

/**
 * セグメント i の制御点を 12 個の float として path から取り出し、呼び出しごとに使う。
 * BezierPath は immutable なので segments[i] を読むだけ。このヘルパで読み出しを 1 か所に集約。
 */
const segmentControlPoints = (
  path: BezierPath<Point3D>,
  startPoints: readonly Point3D[],
  i: number,
): readonly [number, number, number, number, number, number, number, number, number, number, number, number] => {
  const sp = startPoints[i]!
  const seg = path.segments[i]!
  return [
    sp.x,
    sp.y,
    sp.z,
    seg.cp1.x,
    seg.cp1.y,
    seg.cp1.z,
    seg.cp2.x,
    seg.cp2.y,
    seg.cp2.z,
    seg.end.x,
    seg.end.y,
    seg.end.z,
  ]
}

/**
 * 1 セグメントの弧長を線形サンプリング近似で計算する(Point オブジェクトを作らない)。
 *
 * 既存 `segmentLength(start, seg, { samples })` と bit-exact に一致する(同じ式、同じ order)。
 * 差: 中間の `pointAt` が返す `{ x, y, z }` オブジェクトを作らず、プリミティブで計算する。
 */
const segmentArcLengthAllocFree = (
  p0x: number,
  p0y: number,
  p0z: number,
  p1x: number,
  p1y: number,
  p1z: number,
  p2x: number,
  p2y: number,
  p2z: number,
  p3x: number,
  p3y: number,
  p3z: number,
  samples: number,
): number => {
  // 既存 arcLengthTo の reduce と同じ構造を Array.from + reduce で再現
  // 初期: 点は start (p0)、距離 0
  const indices = Array.from({ length: samples }, (_, i) => (i + 1) / samples)
  const result = indices.reduce<{
    readonly len: number
    readonly prevX: number
    readonly prevY: number
    readonly prevZ: number
  }>(
    (acc, t) => {
      const mt = 1 - t
      const mt2 = mt * mt
      const mt3 = mt2 * mt
      const t2 = t * t
      const t3 = t2 * t
      const x = mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x
      const y = mt3 * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3 * p3y
      const z = mt3 * p0z + 3 * mt2 * t * p1z + 3 * mt * t2 * p2z + t3 * p3z
      const dx = x - acc.prevX
      const dy = y - acc.prevY
      const dz = z - acc.prevZ
      return {
        len: acc.len + Math.hypot(dx, dy, dz),
        prevX: x,
        prevY: y,
        prevZ: z,
      }
    },
    { len: 0, prevX: p0x, prevY: p0y, prevZ: p0z },
  )
  return result.len
}

/**
 * パスの各セグメント弧長と累積弧長を Float32Array に書き込む。
 *
 * `createArcLengthIndex` の Float32Array 版に相当する alloc-free 実装。
 * `lengths` / `cumulative` の長さはともに `segments.length`。
 *
 * 返り値: 総弧長。
 */
const computeSegmentLengthsInto = (
  lengths: Float32Array,
  cumulative: Float32Array,
  path: BezierPath<Point3D>,
  startPoints: readonly Point3D[],
  samples: number,
): number => {
  // 各セグメントの弧長を map で計算(配列 1 個だけ alloc、ホットパス外なら許容)
  const segLens = path.segments.map((_, i) => {
    const cp = segmentControlPoints(path, startPoints, i)
    return segmentArcLengthAllocFree(
      cp[0],
      cp[1],
      cp[2],
      cp[3],
      cp[4],
      cp[5],
      cp[6],
      cp[7],
      cp[8],
      cp[9],
      cp[10],
      cp[11],
      samples,
    )
  })
  // Float32Array に反映 + 累積を計算して書き込む(Array#reduce で累積を作ってから forEach で書く)
  const cumulativeArr = segLens.reduce<readonly number[]>((acc, l, i) => {
    const prev = i === 0 ? 0 : acc[i - 1]!
    return [...acc, prev + l]
  }, [])
  segLens.forEach((l, i) => {
    lengths[i] = l
    cumulative[i] = cumulativeArr[i]!
  })
  return cumulativeArr[cumulativeArr.length - 1] ?? 0
}

/**
 * 累積弧長配列から弧長比率に対応するセグメント index と local ratio を求める。
 * `Float32Array` に対する lower-bound 二分探索。
 */
const locateByCumulative = (
  cumulative: Float32Array,
  lengths: Float32Array,
  segCount: number,
  totalLength: number,
  ratio: number,
): { readonly segIdx: number; readonly localRatio: number } => {
  const clamped = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio
  const target = totalLength * clamped

  const search = (lo: number, hi: number): number => {
    if (lo >= hi) return lo
    const mid = (lo + hi) >>> 1
    return cumulative[mid]! < target ? search(mid + 1, hi) : search(lo, mid)
  }
  const raw = search(0, segCount)
  const i = raw >= segCount ? segCount - 1 : raw
  const accumulated = i > 0 ? cumulative[i - 1]! : 0
  const segLen = lengths[i]!
  const localRatio = segLen > 0 ? (target - accumulated) / segLen : 0
  return { segIdx: i, localRatio }
}

/**
 * 弧長比率 `ratio`(0..1)に対応する点と接線を求め、`out` の `frameIdx` 番目の
 * `POSITION` / `TANGENT` スロットに書き込む。オブジェクトリテラルを作らない。
 */
const writeSample = (
  out: Float32Array,
  frameIdx: number,
  path: BezierPath<Point3D>,
  startPoints: readonly Point3D[],
  cumulative: Float32Array,
  lengths: Float32Array,
  segCount: number,
  totalLength: number,
  ratio: number,
): void => {
  const loc = locateByCumulative(cumulative, lengths, segCount, totalLength, ratio)
  const cp = segmentControlPoints(path, startPoints, loc.segIdx)
  const t = loc.localRatio
  const off = frameIdx * FRENET_STRIDE

  // 位置 B(t)
  writePointOnSegment(
    out,
    off + FRENET_OFFSET.POSITION,
    cp[0],
    cp[1],
    cp[2],
    cp[3],
    cp[4],
    cp[5],
    cp[6],
    cp[7],
    cp[8],
    cp[9],
    cp[10],
    cp[11],
    t,
  )

  // 接線 B'(t) = 3(1-t)^2 (P1-P0) + 6(1-t)t (P2-P1) + 3 t^2 (P3-P2)、正規化して書く
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  const c0 = 3 * mt2
  const c1 = 6 * mt * t
  const c2 = 3 * t2
  writeNormalized(
    out,
    off + FRENET_OFFSET.TANGENT,
    c0 * (cp[3] - cp[0]) + c1 * (cp[6] - cp[3]) + c2 * (cp[9] - cp[6]),
    c0 * (cp[4] - cp[1]) + c1 * (cp[7] - cp[4]) + c2 * (cp[10] - cp[7]),
    c0 * (cp[5] - cp[2]) + c1 * (cp[8] - cp[5]) + c2 * (cp[11] - cp[8]),
  )
}

/**
 * サンプル i の T, N, B を double-reflection 法で計算して書き込む(i >= 1)。
 * 先頭フレーム(i = 0)は {@link writeFirstFrame} で別処理。
 */
const writeDoubleReflectionFrame = (out: Float32Array, frameIdx: number): void => {
  const prevOff = (frameIdx - 1) * FRENET_STRIDE
  const off = frameIdx * FRENET_STRIDE

  const ptx = out[prevOff + FRENET_OFFSET.TANGENT]!
  const pty = out[prevOff + FRENET_OFFSET.TANGENT + 1]!
  const ptz = out[prevOff + FRENET_OFFSET.TANGENT + 2]!
  const pnx = out[prevOff + FRENET_OFFSET.NORMAL]!
  const pny = out[prevOff + FRENET_OFFSET.NORMAL + 1]!
  const pnz = out[prevOff + FRENET_OFFSET.NORMAL + 2]!

  const tx = out[off + FRENET_OFFSET.TANGENT]!
  const ty = out[off + FRENET_OFFSET.TANGENT + 1]!
  const tz = out[off + FRENET_OFFSET.TANGENT + 2]!

  // m = t + prev.t
  const mx = tx + ptx
  const my = ty + pty
  const mz = tz + ptz
  const mLen2 = mx * mx + my * my + mz * mz
  const safeLen2 = mLen2 < EPS ? 1 : mLen2
  const dotMN = (mx * pnx + my * pny + mz * pnz) * 2

  // n = reflect(prev.n) 正規化して書き込み
  writeNormalized(
    out,
    off + FRENET_OFFSET.NORMAL,
    pnx - (mx * dotMN) / safeLen2,
    pny - (my * dotMN) / safeLen2,
    pnz - (mz * dotMN) / safeLen2,
  )

  // b = t × n
  const nx = out[off + FRENET_OFFSET.NORMAL]!
  const ny = out[off + FRENET_OFFSET.NORMAL + 1]!
  const nz = out[off + FRENET_OFFSET.NORMAL + 2]!
  out[off + FRENET_OFFSET.BINORMAL] = ty * nz - tz * ny
  out[off + FRENET_OFFSET.BINORMAL + 1] = tz * nx - tx * nz
  out[off + FRENET_OFFSET.BINORMAL + 2] = tx * ny - ty * nx
}

/**
 * 先頭フレーム(i = 0)の N, B を初期化する。P, T は書き込み済み前提。
 * N は T と直交する任意軸を helper にして N = normalize(T × helper) を作る。
 * |T| の最小成分を helper 軸にすることで、T とほぼ平行になる退化を避ける。
 */
const writeFirstFrame = (out: Float32Array): void => {
  const tx = out[FRENET_OFFSET.TANGENT]!
  const ty = out[FRENET_OFFSET.TANGENT + 1]!
  const tz = out[FRENET_OFFSET.TANGENT + 2]!
  const ax = Math.abs(tx)
  const ay = Math.abs(ty)
  const az = Math.abs(tz)
  const hx = ax <= ay && ax <= az ? 1 : 0
  const hy = ax <= ay && ax <= az ? 0 : ay <= az ? 1 : 0
  const hz = ax <= ay && ax <= az ? 0 : ay <= az ? 0 : 1

  // n0 = normalize(t × helper)
  writeNormalized(out, FRENET_OFFSET.NORMAL, ty * hz - tz * hy, tz * hx - tx * hz, tx * hy - ty * hx)

  // b0 = t × n
  const nx = out[FRENET_OFFSET.NORMAL]!
  const ny = out[FRENET_OFFSET.NORMAL + 1]!
  const nz = out[FRENET_OFFSET.NORMAL + 2]!
  out[FRENET_OFFSET.BINORMAL] = ty * nz - tz * ny
  out[FRENET_OFFSET.BINORMAL + 1] = tz * nx - tx * nz
  out[FRENET_OFFSET.BINORMAL + 2] = tx * ny - ty * nx
}

/**
 * 3D ベジェパスに沿って `samples` 個の Frenet フレームを double-reflection 法で計算し、
 * 指定された `Float32Array` に interleave 書き込む(in-place、新規 alloc なし)。
 *
 * ## レイアウト
 * `out[frameIdx * FRENET_STRIDE + FRENET_OFFSET.*]` でアクセス。
 * `[px, py, pz, tx, ty, tz, nx, ny, nz, bx, by, bz] × samples`。
 *
 * ## 性能
 * - 3 次ベジェ式を手展開し、`pointAt` / `tangentAt` を呼ばない
 * - `createArcLengthIndex` を使わず `Float32Array` で弧長計算(Point alloc ゼロ)
 * - `out` は呼び出し側で確保 / 再利用する(長さ `samples * FRENET_STRIDE` 以上)
 *
 * ## 精度
 * `options.arcLengthSamples`(既定 64)で弧長計算精度を制御する。既存
 * `segmentLength` と同じサンプル数なら bit-exact な弧長値が得られる。
 *
 * @param out 出力バッファ(長さ `samples * FRENET_STRIDE` 以上)
 * @param path 3D ベジェパス
 * @param samples サンプル点数(≥ 2)
 * @param options 精度オプション
 * @throws `samples < 2` または `path.segments` が空の場合
 */
export const writeFrenetFrames = (
  out: Float32Array,
  path: BezierPath<Point3D>,
  samples: number,
  options: FrenetOptions = {},
): void => {
  if (samples < 2) throw new Error('writeFrenetFrames: samples must be >= 2')
  const segCount = path.segments.length
  if (segCount === 0) throw new Error('writeFrenetFrames: path has no segments')

  const arcLengthSamples = options.arcLengthSamples ?? DEFAULT_ARC_LENGTH_SAMPLES

  // start point 配列を作る(path.start + 各 segment.end の slice(0, -1))
  const startPoints: readonly Point3D[] = [path.start, ...path.segments.slice(0, -1).map((s) => s.end)]

  // 弧長インデックスを Float32Array で構築(Point alloc なし)
  const lengths = new Float32Array(segCount)
  const cumulative = new Float32Array(segCount)
  const totalLength = computeSegmentLengthsInto(lengths, cumulative, path, startPoints, arcLengthSamples)

  // 全サンプルの位置 / 接線を書く(ループは Array.from + forEach で関数型に)
  Array.from({ length: samples }, (_, i) => i).forEach((i) => {
    const ratio = i / (samples - 1)
    writeSample(out, i, path, startPoints, cumulative, lengths, segCount, totalLength, ratio)
  })

  // 先頭フレームの N, B を初期化
  writeFirstFrame(out)

  // 以降を double-reflection で決定
  Array.from({ length: samples - 1 }, (_, i) => i + 1).forEach((i) => {
    writeDoubleReflectionFrame(out, i)
  })
}

/**
 * `Float32Array` から 1 フレーム分を読み出して {@link FrenetFrame} オブジェクトを返す。
 *
 * テスト / デバッグ / 単発利用向け。ホットパスでは `out` を直接 `FRENET_STRIDE` /
 * `FRENET_OFFSET` で読むこと(オブジェクト生成を避けるため)。
 *
 * @param frames `writeFrenetFrames` で書き込んだバッファ
 * @param frameIdx 0 〜 `samples - 1`
 */
export const readFrenetFrame = (frames: Float32Array, frameIdx: number): FrenetFrame => {
  const o = frameIdx * FRENET_STRIDE
  return {
    position: {
      x: frames[o + FRENET_OFFSET.POSITION]!,
      y: frames[o + FRENET_OFFSET.POSITION + 1]!,
      z: frames[o + FRENET_OFFSET.POSITION + 2]!,
    },
    tangent: {
      x: frames[o + FRENET_OFFSET.TANGENT]!,
      y: frames[o + FRENET_OFFSET.TANGENT + 1]!,
      z: frames[o + FRENET_OFFSET.TANGENT + 2]!,
    },
    normal: {
      x: frames[o + FRENET_OFFSET.NORMAL]!,
      y: frames[o + FRENET_OFFSET.NORMAL + 1]!,
      z: frames[o + FRENET_OFFSET.NORMAL + 2]!,
    },
    binormal: {
      x: frames[o + FRENET_OFFSET.BINORMAL]!,
      y: frames[o + FRENET_OFFSET.BINORMAL + 1]!,
      z: frames[o + FRENET_OFFSET.BINORMAL + 2]!,
    },
  }
}

/**
 * 3D ベジェパスから Frenet フレーム配列を一度に計算して返す(簡便版)。
 *
 * デバッグ / テスト / 単発利用向け。ホットパスでは {@link writeFrenetFrames} で
 * 事前確保した `Float32Array` に書き込む方が高速。
 *
 * @param path 3D ベジェパス
 * @param samples サンプル点数(≥ 2)
 * @param options 精度オプション
 */
export const computeFrenetFrames = (
  path: BezierPath<Point3D>,
  samples: number,
  options: FrenetOptions = {},
): readonly FrenetFrame[] => {
  const out = new Float32Array(samples * FRENET_STRIDE)
  writeFrenetFrames(out, path, samples, options)
  return Array.from({ length: samples }, (_, i) => readFrenetFrame(out, i))
}
