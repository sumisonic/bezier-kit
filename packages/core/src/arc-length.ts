import type { BezierPath, BezierSegment, Point } from './types'
import { binarySearchIndex, clamp, distance, scan } from './math'
import {
  DEFAULT_ARC_LENGTH_SAMPLES,
  assertArcLengthSamples,
  pointAt,
  segmentStartPoints,
  type ArcLengthOptions,
} from './segment'

/**
 * {@link createArcLengthIndex} の `locate` が返す位置情報。
 *
 * `segmentIndex` は該当するセグメントの添字、`localRatio` はそのセグメント内での
 * 距離比率(0〜1)を表す。ベジェのパラメータ `t` ではない(`t` が要るなら {@link ArcLengthParam})。
 */
export type ArcLengthLocation = {
  readonly segmentIndex: number
  readonly localRatio: number
}

/**
 * {@link createArcLengthParameterizer} の `locateParam` が返す位置情報。
 *
 * `segmentIndex` は該当するセグメントの添字、`t` はそのセグメント上のベジェパラメータ(0〜1)。
 * 弧長からの逆変換まで済んでいるので、そのまま {@link pointAt} / {@link splitSegmentAt} に渡せる。
 */
export type ArcLengthParam = {
  readonly segmentIndex: number
  readonly t: number
}

/**
 * {@link createArcLengthIndex} の返却型。
 */
export type ArcLengthIndex<P extends Point> = {
  /** 各セグメントの弧長 */
  readonly lengths: readonly number[]
  /** 先頭から各セグメント末尾までの累積弧長(長さは `lengths.length`) */
  readonly cumulativeLengths: readonly number[]
  /** パス全体の弧長 */
  readonly totalLength: number
  /** 各セグメントの始点 */
  readonly startPoints: readonly P[]
  /** 弧長比率 `ratio`(内部で 0〜1 に clamp。NaN は 0)から位置情報を返す関数 */
  readonly locate: (ratio: number) => ArcLengthLocation
}

/**
 * {@link createArcLengthParameterizer} の返却型。
 *
 * `index` は {@link ArcLengthIndex} そのもの。`locateParam` は弧長比率からベジェパラメータ `t` まで
 * 一気に求める関数で、内部のセグメントごとの累積弧長表(LUT)を引く。
 */
export type ArcLengthParameterizer<P extends Point> = {
  readonly index: ArcLengthIndex<P>
  /** 弧長比率 `ratio`(内部で 0〜1 に clamp。NaN は 0)からセグメント添字と `t` を返す関数 */
  readonly locateParam: (ratio: number) => ArcLengthParam
}

/**
 * 1 セグメントの累積弧長表を `out[offset .. offset + samples]` に書く(`out[offset + k]` は `t = k / samples` までの折れ線長)。
 *
 * {@link arcLengthTo}`(start, seg, 1, { samples })` と同じ式・同じ加算順なので、
 * `out[offset + samples]` は {@link segmentLength} と同じ値になる(浮動小数まで一致)。
 *
 * @returns セグメント全体の弧長(= `out[offset + samples]`)
 */
const writeSegmentArcLengthTable = <P extends Point>(
  out: Float64Array,
  offset: number,
  start: P,
  seg: BezierSegment<P>,
  samples: number,
): number => {
  out[offset] = 0
  const { len } = Array.from({ length: samples }, (_, i) => (i + 1) / samples).reduce<{
    readonly len: number
    readonly prev: P
  }>(
    (acc, t, i) => {
      const pt = pointAt(start, seg, t)
      const len = acc.len + distance(acc.prev, pt)
      out[offset + i + 1] = len
      return { len, prev: pt }
    },
    { len: 0, prev: start },
  )
  return len
}

/**
 * パスの弧長情報を事前計算し、弧長比率 `ratio`(0〜1)からセグメント添字とベジェパラメータ `t` を
 * 返す関数(`locateParam`)と、従来の {@link ArcLengthIndex}(`index`)をまとめて生成する。
 *
 * - 構築時にセグメントごとの累積弧長表(`samples + 1` 点、`Float64Array`)を作る。この表の末尾が各セグメントの弧長で、
 *   {@link segmentLength} と同じ値になる。曲線上の点の評価回数は従来の {@link createArcLengthIndex} と同じで、表の確保と書き込みが加わる
 * - `locateParam` は累積長でセグメントを二分探索し、そのセグメントの表を二分探索して区間内を線形補間する。
 *   {@link arcLengthToParam}(反復ごとに 64 点を測り直す二分探索)と違い、呼び出しごとの点の評価が無い
 * - 同じ表を引くので、`locate` の距離比率と `locateParam` の `t` は同じ近似モデル(`samples` 分割の折れ線)に基づく
 * - `ratio` は内部で `clamp(0, 1)`。NaN は 0 として扱う
 * - セグメントが無いパスでは `locateParam` は `{ segmentIndex: -1, t: 0 }` を返す(番兵。呼び出し側で先に弾くこと)
 * - `samples` は 1 以上の整数。それ以外は `RangeError`
 *
 * 同じパスに対して弧長比率の問い合わせを何度も行うとき(分割、パス上の等間隔配置、アニメーション)に使う。
 * 1 回だけなら {@link pointAtLength} / {@link tangentAtLength} で足りる。
 *
 * 2D / 3D 両対応。
 *
 * @param path - 対象のパス
 * @param options - 各セグメントの弧長表の分割数(`samples`、既定 64、1 以上の整数)
 * @throws `samples` が 1 以上の整数でない場合(`RangeError`)
 */
export const createArcLengthParameterizer = <P extends Point>(
  path: BezierPath<P>,
  options: ArcLengthOptions = {},
): ArcLengthParameterizer<P> => {
  const samples = options.samples ?? DEFAULT_ARC_LENGTH_SAMPLES
  assertArcLengthSamples(samples, 'createArcLengthParameterizer')
  const knots = samples + 1
  const startPoints = segmentStartPoints(path)
  const segmentCount = path.segments.length
  const table = new Float64Array(segmentCount * knots)
  const lengths = path.segments.map((seg, i) => {
    const sp = startPoints[i]
    return sp === undefined ? 0 : writeSegmentArcLengthTable(table, i * knots, sp, seg, samples)
  })
  const cumulativeLengths = scan(lengths, 0, (acc, l) => acc + l)
  const totalLength = cumulativeLengths[cumulativeLengths.length - 1] ?? 0

  const locate = (ratio: number): ArcLengthLocation => {
    const clamped = Number.isNaN(ratio) ? 0 : clamp(ratio, 0, 1)
    const target = totalLength * clamped

    const raw = binarySearchIndex(cumulativeLengths, target)
    const i = raw >= segmentCount ? segmentCount - 1 : raw
    const accumulated = i > 0 ? (cumulativeLengths[i - 1] ?? 0) : 0
    const segLen = lengths[i] ?? 0

    return {
      segmentIndex: i,
      localRatio: segLen > 0 ? (target - accumulated) / segLen : 0,
    }
  }

  const locateParam = (ratio: number): ArcLengthParam => {
    // 端点は表を引かずに厳密に返す(累積長の丸めで localRatio が 0.999… になっても末尾は t=1)
    const clamped = Number.isNaN(ratio) ? 0 : clamp(ratio, 0, 1)
    if (segmentCount === 0) return { segmentIndex: -1, t: 0 }
    if (clamped <= 0) return { segmentIndex: 0, t: 0 }
    if (clamped >= 1) return { segmentIndex: segmentCount - 1, t: 1 }

    const { segmentIndex, localRatio } = locate(clamped)
    const segLen = lengths[segmentIndex] ?? 0
    if (segLen <= 0 || localRatio <= 0) return { segmentIndex, t: 0 }
    if (localRatio >= 1) return { segmentIndex, t: 1 }

    const target = localRatio * segLen
    const base = segmentIndex * knots
    // 表の中で target 以上になる最初の knot k(1 〜 samples)を二分探索する
    const search = (lo: number, hi: number): number => {
      if (lo >= hi) return lo
      const mid = (lo + hi) >>> 1
      return (table[base + mid] ?? 0) < target ? search(mid + 1, hi) : search(lo, mid)
    }
    const k = search(1, samples)
    const l0 = table[base + k - 1] ?? 0
    const l1 = table[base + k] ?? l0
    const frac = l1 > l0 ? (target - l0) / (l1 - l0) : 0
    return { segmentIndex, t: (k - 1 + frac) / samples }
  }

  return { index: { lengths, cumulativeLengths, totalLength, startPoints, locate }, locateParam }
}

/**
 * パスの弧長情報を事前計算し、距離比率 `ratio`(0〜1)から
 * セグメントインデックスとセグメント内比率を返す関数を生成する。
 *
 * - 累積長は {@link scan} で O(N) 構築
 * - `locate` は {@link binarySearchIndex} で O(log N) 検索
 * - `ratio` は内部で `clamp(0, 1)` されるため、範囲外値でも安全(NaN は 0)
 *
 * `locate` が返すのは距離比率で、ベジェの `t` ではない。`t` まで欲しいときは
 * {@link createArcLengthParameterizer} の `locateParam` を使う(同じ構築コストで、呼び出しごとの点の評価が無い)。
 *
 * 2D / 3D 両対応。`startPoints` は入力パスと同じ次元。
 *
 * @param path - 対象のパス
 * @param options - 各セグメントの弧長計算精度
 */
export const createArcLengthIndex = <P extends Point>(
  path: BezierPath<P>,
  options: ArcLengthOptions = {},
): ArcLengthIndex<P> => createArcLengthParameterizer(path, options).index
