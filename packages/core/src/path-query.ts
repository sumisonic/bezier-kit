import type { BezierPath, Point } from './types'
import { pointAt, tangentAt, type ArcLengthOptions } from './segment'
import { createArcLengthParameterizer } from './arc-length'

/**
 * 弧長比率(0〜1)で {@link BezierPath} 上の点を返す。
 *
 * `ratio` は内部で `clamp(0, 1)` されるため、範囲外でも安全。
 * 呼び出しごとにパス全体の弧長表を作るので、1 回だけ呼ぶ用途に向く。複数回呼ぶ場合は
 * {@link createArcLengthParameterizer} を 1 回作って `locateParam` を使い回す。
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

  const {
    index: { startPoints },
    locateParam,
  } = createArcLengthParameterizer(path, options)
  const { segmentIndex, t } = locateParam(ratio)
  return pointAt(startPoints[segmentIndex]!, path.segments[segmentIndex]!, t)
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
 * 呼び出しごとにパス全体の弧長表を作るので、複数回呼ぶ場合は
 * {@link createArcLengthParameterizer} を 1 回作って `locateParam` + {@link tangentAt} を使う。
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

  const {
    index: { startPoints },
    locateParam,
  } = createArcLengthParameterizer(path, options)
  const { segmentIndex, t } = locateParam(ratio)
  return tangentAt(startPoints[segmentIndex]!, path.segments[segmentIndex]!, t)
}
