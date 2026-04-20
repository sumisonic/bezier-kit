import type { BezierPath, Point } from '../types'
import { splitSegmentAt } from '../segment'
import { createArcLengthIndex } from '../arc-length'
import { arcLengthToParam } from '../arc-length-param'

/**
 * パスを弧長比率で分割する関数を返す。
 *
 * 弧長の事前計算はクロージャに閉じ込められるため、同一パスの複数回分割でも高速。
 * `ratio` は内部で `clamp(0, 1)` されるため、範囲外値でも安全。
 *
 * 戻り値は `[前半パス, 後半パス]`。分割点は前半の最終セグメントの `end` であり、
 * これは後半の始点と完全に一致する(De Casteljau 分割の性質)。
 *
 * 2D / 3D 両対応。
 *
 * @param path - 分割対象のパス
 * @returns `ratio` を受け取り `[前半パス, 後半パス]` を返す関数
 */
export const createPathSplitter = <P extends Point>(
  path: BezierPath<P>,
): ((ratio: number) => readonly [BezierPath<P>, BezierPath<P>]) => {
  const { lengths, startPoints, locate } = createArcLengthIndex(path)

  return (ratio: number): readonly [BezierPath<P>, BezierPath<P>] => {
    const { segmentIndex: i, localRatio } = locate(ratio)
    const seg = path.segments[i]
    const sp = startPoints[i]
    const segLen = lengths[i] ?? 0

    if (seg === undefined || sp === undefined) {
      // 防御的フォールバック(locate の契約上ここには来ない)
      return [path, { start: path.start, segments: [] }]
    }

    const t = arcLengthToParam(sp, seg, localRatio, segLen)
    const [left, right] = splitSegmentAt(sp, seg, t)

    return [
      { start: path.start, segments: [...path.segments.slice(0, i), left] },
      { start: left.end, segments: [right, ...path.segments.slice(i + 1)] },
    ]
  }
}
