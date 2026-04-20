import type { BezierPath, BezierSegment, Point } from '../types'
import { splitSegmentAt } from '../segment'
import { createArcLengthIndex } from '../arc-length'

/**
 * 1 つのセグメントをパラメータベースで `n` 等分する(等 `t` 分割、等弧長ではない)。
 *
 * 等弧長で分割したい場合は `arcLengthToParam` 経由の別実装が必要。
 * 本関数は De Casteljau で先頭から `1/n` を切り出し、残りを再帰的に分割する。
 *
 * @param start - セグメントの始点
 * @param seg - 分割対象のセグメント
 * @param n - 分割数
 */
const subdivideSegment = <P extends Point>(start: P, seg: BezierSegment<P>, n: number): readonly BezierSegment<P>[] => {
  if (n <= 1) return [seg]

  const t = 1 / n
  const [left, right] = splitSegmentAt(start, seg, t)

  return [left, ...subdivideSegment(left.end, right, n - 1)]
}

/**
 * 各セグメントへの分割数を弧長比率で配分する。
 * 合計が `targetCount` になるよう端数を残余が大きい順に +1 する。
 *
 * 端数配分の検索は `Set` を用いて O(N)。
 *
 * @param lengths - 各セグメントの弧長
 * @param totalLength - パス全体の弧長
 * @param targetCount - 目標セグメント数
 * @param segmentCount - 現在のセグメント数
 */
const distributeCounts = (
  lengths: readonly number[],
  totalLength: number,
  targetCount: number,
  segmentCount: number,
): readonly number[] => {
  const extra = targetCount - segmentCount
  const rawCounts = lengths.map((l) => 1 + (totalLength > 0 ? (l / totalLength) * extra : extra / segmentCount))
  const floored = rawCounts.map(Math.floor)
  const shortage = targetCount - floored.reduce((sum, n) => sum + n, 0)

  const topIndices = new Set(
    rawCounts
      .map((raw, i) => ({ i, remainder: raw - floored[i]! }))
      .sort((a, b) => b.remainder - a.remainder)
      .slice(0, shortage)
      .map(({ i }) => i),
  )

  return floored.map((count, i) => count + (topIndices.has(i) ? 1 : 0))
}

/**
 * パスのセグメント数を `targetCount` に増やす。
 * 各セグメントの弧長に比例して分割数を配分し、曲線の形状を保持する。
 *
 * @param path - 対象のパス
 * @param targetCount - 目標セグメント数
 */
const subdividePath = <P extends Point>(path: BezierPath<P>, targetCount: number): BezierPath<P> => {
  if (path.segments.length >= targetCount) return path

  const { lengths, totalLength, startPoints } = createArcLengthIndex(path)
  const counts = distributeCounts(lengths, totalLength, targetCount, path.segments.length)
  const segments = path.segments.flatMap((seg, i) => {
    const sp = startPoints[i]
    const cnt = counts[i] ?? 1
    return sp === undefined ? [seg] : subdivideSegment(sp, seg, cnt)
  })

  return { start: path.start, segments }
}

/**
 * 2 つのパスのセグメント数を揃える。
 * セグメント数が多い方に合わせ、少ない方を弧長比例で(等 `t` で)分割する。
 *
 * 2D / 3D 両対応。型パラメータ `P` で次元の一致が型レベルで保証される
 * (2D と 3D の混在は型エラー)。
 *
 * @param a - パス 1
 * @param b - パス 2
 * @returns セグメント数が揃った `[パス 1, パス 2]`
 */
export const matchSegmentCount = <P extends Point>(
  a: BezierPath<P>,
  b: BezierPath<P>,
): readonly [BezierPath<P>, BezierPath<P>] => {
  const countA = a.segments.length
  const countB = b.segments.length

  if (countA === countB) return [a, b]
  if (countA < countB) return [subdividePath(a, countB), b]
  return [a, subdividePath(b, countA)]
}
