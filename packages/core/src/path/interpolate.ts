import type { BezierPath, BezierSegment, Point } from '../types'
import { lerpPoint } from '../math'
import { matchSegmentCount } from './match-count'

/**
 * 2 つのセグメントを線形補間する。
 *
 * @param a - 補間元セグメント
 * @param b - 補間先セグメント
 * @param t - 補間係数(範囲外可)
 */
const lerpSegment = <P extends Point>(a: BezierSegment<P>, b: BezierSegment<P>, t: number): BezierSegment<P> => ({
  cp1: lerpPoint(a.cp1, b.cp1, t),
  cp2: lerpPoint(a.cp2, b.cp2, t),
  end: lerpPoint(a.end, b.end, t),
})

/**
 * セグメント数が同じ 2 つのパスを補間する関数を返す。
 * セグメント数が異なる場合はエラーをスローする。
 *
 * `t` はそのまま各制御点の線形補間に渡すため、Back / Elastic 系 easing で
 * `t` が 0〜1 の範囲外に出ても正しく外挿される。
 *
 * 2D / 3D 両対応。2 つのパスは同じ次元 `P` でなければならない(型エラー)。
 *
 * @param from - 補間元パス
 * @param to - 補間先パス
 * @returns `t` を受け取り補間後の {@link BezierPath} を返す関数
 * @throws `from` と `to` のセグメント数が一致しない場合
 */
export const createPathInterpolatorStrict = <P extends Point>(
  from: BezierPath<P>,
  to: BezierPath<P>,
): ((t: number) => BezierPath<P>) => {
  if (from.segments.length !== to.segments.length) {
    throw new Error(`Segment count mismatch: from has ${from.segments.length}, to has ${to.segments.length}`)
  }

  const pairs = from.segments.map((seg, i) => [seg, to.segments[i]] as const)

  return (t: number): BezierPath<P> => ({
    start: lerpPoint(from.start, to.start, t),
    segments: pairs.map(([a, b]) => lerpSegment(a, b!, t)),
  })
}

/**
 * 2 つのパスを補間する関数を返す。
 * セグメント数が異なる場合は {@link matchSegmentCount} で自動的に揃える。
 *
 * `t` は範囲外も許容され外挿される。
 *
 * 2D / 3D 両対応。2 つのパスは同じ次元 `P` でなければならない(型エラー)。
 *
 * @param from - 補間元パス
 * @param to - 補間先パス
 * @returns `t` を受け取り補間後の {@link BezierPath} を返す関数
 */
export const createPathInterpolator = <P extends Point>(
  from: BezierPath<P>,
  to: BezierPath<P>,
): ((t: number) => BezierPath<P>) => {
  const [adjustedFrom, adjustedTo] = matchSegmentCount(from, to)
  return createPathInterpolatorStrict(adjustedFrom, adjustedTo)
}
