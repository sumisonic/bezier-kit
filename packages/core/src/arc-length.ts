import type { BezierPath, Point } from './types'
import { binarySearchIndex, clamp, scan } from './math'
import { segmentLength, segmentStartPoints, type ArcLengthOptions } from './segment'

/**
 * {@link createArcLengthIndex} の `locate` が返す位置情報。
 *
 * `segmentIndex` は該当するセグメントの添字、`localRatio` はそのセグメント内での
 * 距離比率(0〜1)を表す。
 */
export type ArcLengthLocation = {
  readonly segmentIndex: number
  readonly localRatio: number
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
  /** 弧長比率 `ratio`(内部で 0〜1 に clamp)から位置情報を返す関数 */
  readonly locate: (ratio: number) => ArcLengthLocation
}

/**
 * パスの弧長情報を事前計算し、距離比率 `ratio`(0〜1)から
 * セグメントインデックスとセグメント内比率を返す関数を生成する。
 *
 * - 累積長は {@link scan} で O(N) 構築
 * - `locate` は {@link binarySearchIndex} で O(log N) 検索
 * - `ratio` は内部で `clamp(0, 1)` されるため、範囲外値でも安全
 *
 * 2D / 3D 両対応。`startPoints` は入力パスと同じ次元。
 *
 * @param path - 対象のパス
 * @param options - 各セグメントの弧長計算精度
 */
export const createArcLengthIndex = <P extends Point>(
  path: BezierPath<P>,
  options: ArcLengthOptions = {},
): ArcLengthIndex<P> => {
  const startPoints = segmentStartPoints(path)
  const lengths = path.segments.map((seg, i) => {
    const sp = startPoints[i]
    return sp === undefined ? 0 : segmentLength(sp, seg, options)
  })
  const cumulativeLengths = scan(lengths, 0, (acc, l) => acc + l)
  const totalLength = cumulativeLengths[cumulativeLengths.length - 1] ?? 0

  const locate = (ratio: number): ArcLengthLocation => {
    const clamped = clamp(ratio, 0, 1)
    const target = totalLength * clamped

    const raw = binarySearchIndex(cumulativeLengths, target)
    const i = raw >= path.segments.length ? path.segments.length - 1 : raw
    const accumulated = i > 0 ? (cumulativeLengths[i - 1] ?? 0) : 0
    const segLen = lengths[i] ?? 0

    return {
      segmentIndex: i,
      localRatio: segLen > 0 ? (target - accumulated) / segLen : 0,
    }
  }

  return { lengths, cumulativeLengths, totalLength, startPoints, locate }
}
