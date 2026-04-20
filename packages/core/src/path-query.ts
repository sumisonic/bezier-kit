import type { BezierPath, Point } from './types'
import { pointAt, tangentAt, type ArcLengthOptions } from './segment'
import { createArcLengthIndex } from './arc-length'
import { arcLengthToParam } from './arc-length-param'

/**
 * 弧長比率(0〜1)で {@link BezierPath} 上の点を返す。
 *
 * `ratio` は内部で `clamp(0, 1)` されるため、範囲外でも安全。
 * 事前計算しないため 1 回だけ呼ぶ用途に向く。複数回呼ぶ場合は
 * {@link createArcLengthIndex} と {@link arcLengthToParam} を直接使い、
 * 事前計算結果を再利用する方が高速。
 *
 * 2D / 3D 両対応。
 *
 * @param path - 対象のパス
 * @param ratio - 弧長比率(0〜1、範囲外は clamp)
 * @param options - 弧長計算の精度
 * @throws `path.segments` が空の場合
 */
export const pointAtLength = <P extends Point>(
  path: BezierPath<P>,
  ratio: number,
  options: ArcLengthOptions = {},
): P => {
  if (path.segments.length === 0) throw new Error('pointAtLength: path has no segments')

  const { lengths, startPoints, locate } = createArcLengthIndex(path, options)
  const { segmentIndex, localRatio } = locate(ratio)
  const seg = path.segments[segmentIndex]!
  const sp = startPoints[segmentIndex]!
  const segLen = lengths[segmentIndex] ?? 0

  const t = arcLengthToParam(sp, seg, localRatio, segLen, options)
  return pointAt(sp, seg, t)
}

/**
 * 弧長比率(0〜1)における {@link BezierPath} 上の接線ベクトルを返す。
 *
 * 接線は {@link tangentAt}(解析微分 `B'(t)`)で計算するため精度パラメータは不要。
 *
 * 2D で「進行方向の角度(ラジアン)」が必要なら戻り値から `Math.atan2(v.y, v.x)` で
 * 取得できる。3D では単一角度では方向を表せないため、ベクトルそのものを用いる。
 *
 * 接線ゼロ(cusp)の場合も計算結果をそのまま返す点に注意(ユーザー側で
 * `Math.hypot(...) < eps` などで判定する)。
 *
 * @param path - 対象のパス
 * @param ratio - 弧長比率(0〜1、範囲外は clamp)
 * @param options - 弧長計算の精度
 * @throws `path.segments` が空の場合
 */
export const tangentAtLength = <P extends Point>(
  path: BezierPath<P>,
  ratio: number,
  options: ArcLengthOptions = {},
): P => {
  if (path.segments.length === 0) throw new Error('tangentAtLength: path has no segments')

  const { lengths, startPoints, locate } = createArcLengthIndex(path, options)
  const { segmentIndex, localRatio } = locate(ratio)
  const seg = path.segments[segmentIndex]!
  const sp = startPoints[segmentIndex]!
  const segLen = lengths[segmentIndex] ?? 0

  const t = arcLengthToParam(sp, seg, localRatio, segLen, options)
  return tangentAt(sp, seg, t)
}
