import { createPathInterpolator, lerp, type Point2D } from '@sumisonic/bezier-kit-core'
import { createColorLerp, lerpColor } from './color'
import type { GradientStop, LinearGradient, StrokeStyle, StyledBezierPath } from './types'

/**
 * 昇順ソートされた `offsets` 配列に対して、`target` を含む区間 `[i, i+1]` の
 * 開始インデックス `i` を返す。
 *
 * `target` が末尾以降なら `offsets.length - 2`、先頭以前なら `0`。
 *
 * @param offsets - 昇順ソート済みの `offset` 配列
 * @param target - 検索対象の値
 */
const findInterval = (offsets: readonly number[], target: number): number => {
  if (offsets.length <= 1) return 0
  const last = offsets.length - 1
  const idx = offsets.findIndex((_, i) => i === last || (offsets[i + 1] ?? Infinity) >= target)
  return Math.max(0, Math.min(idx === -1 ? last : idx, last - 1))
}

/**
 * `stops` 数を `targetCount` に合わせる。
 *
 * 既存の `stops` の間に線形補間した `stops` を挿入して数を増やす。
 * `targetCount` より多い場合は先頭から `targetCount` 個を返す。
 *
 * @param stops - 元の `stop` 配列
 * @param targetCount - 目標 `stop` 数
 */
const padStops = (stops: readonly GradientStop[], targetCount: number): readonly GradientStop[] => {
  if (stops.length >= targetCount) return stops.slice(0, targetCount)
  if (stops.length === 0) return Array.from({ length: targetCount }, () => ({ offset: 0, color: '#000000' }))
  if (stops.length === 1) return Array.from({ length: targetCount }, () => ({ ...stops[0]! }))

  const firstOffset = stops[0]!.offset
  const offsetRange = stops[stops.length - 1]!.offset - firstOffset

  const offsets = stops.map((s) => s.offset)

  return Array.from({ length: targetCount }, (_, i) => {
    const targetOffset = (i / (targetCount - 1)) * offsetRange + firstOffset
    const lo = findInterval(offsets, targetOffset)
    const hi = lo + 1
    const sLo = stops[lo]!
    const sHi = stops[hi] ?? sLo
    const range = sHi.offset - sLo.offset
    const localT = range > 0 ? (targetOffset - sLo.offset) / range : 0
    return { offset: targetOffset, color: lerpColor(sLo.color, sHi.color, localT) }
  })
}

/**
 * グラデーションがない stroke から仮のグラデーションを生成する。
 * `ref` のグラデーション構造(座標・stop 数)を借りて、全 stop を同一色にする。
 *
 * @param color - 単色の色文字列
 * @param ref - 構造を借りるグラデーション
 */
const gradientFromColor = (color: string, ref: LinearGradient): LinearGradient => ({
  x1: ref.x1,
  y1: ref.y1,
  x2: ref.x2,
  y2: ref.y2,
  stops: ref.stops.map((s) => ({ offset: s.offset, color })),
})

/**
 * `from` / `to` のグラデーション有無を解決し、補間可能なペアを返す。
 * 片方にしかない場合は単色から仮グラデーションを生成する。
 *
 * @param a - 補間元のストロークスタイル
 * @param b - 補間先のストロークスタイル
 */
const resolveGradientPair = (
  a: StrokeStyle | undefined,
  b: StrokeStyle | undefined,
): readonly [LinearGradient | undefined, LinearGradient | undefined] => {
  const aGrad = a?.gradient
  const bGrad = b?.gradient
  if (aGrad && !bGrad) return [aGrad, gradientFromColor(b?.color ?? '#ffffff', aGrad)]
  if (!aGrad && bGrad) return [gradientFromColor(a?.color ?? '#ffffff', bGrad), bGrad]
  return [aGrad, bGrad]
}

/**
 * 2 つのグラデーション補間関数を事前構築する。
 * 構築時に `padStops` と `createColorLerp` を実行し、クロージャに閉じ込める。
 *
 * @param a - 補間元
 * @param b - 補間先
 */
const createGradientLerp = (a: LinearGradient, b: LinearGradient): ((t: number) => LinearGradient) => {
  const count = Math.max(a.stops.length, b.stops.length)
  const aStops = a.stops.length === count ? a.stops : padStops(a.stops, count)
  const bStops = b.stops.length === count ? b.stops : padStops(b.stops, count)
  const stopInterpolators = aStops.map((s, i) => ({
    offsetA: s.offset,
    offsetB: bStops[i]!.offset,
    color: createColorLerp(s.color, bStops[i]!.color),
  }))

  return (t: number): LinearGradient => ({
    x1: lerp(a.x1, b.x1, t),
    y1: lerp(a.y1, b.y1, t),
    x2: lerp(a.x2, b.x2, t),
    y2: lerp(a.y2, b.y2, t),
    stops: stopInterpolators.map((si) => ({
      offset: lerp(si.offsetA, si.offsetB, t),
      color: si.color(t),
    })),
  })
}

/**
 * 2 つのストロークスタイルの補間関数を事前構築する。
 *
 * 構築時にグラデーション解決・stop 均衡化・色パースを実行し、
 * 毎フレームは数値 `lerp` と `toHexColor` のみで済むようにする。
 *
 * 補間仕様:
 *
 * | 入力 | 出力 |
 * |---|---|
 * | 両方 `undefined` | 常に `undefined` |
 * | 片方だけ | 固定値(補間なし) |
 * | 両方にあり、両方 `width` あり | `width` を線形補間 |
 * | 片方だけ `width` | 固定値 |
 * | 両方にあり、両方 `color` あり | `color` を線形補間 |
 * | 両方にあり、片方だけ `gradient` | `color` から仮グラデーションを合成して補間 |
 * | 両方 `gradient` あり | `stop` 数を揃えて補間 |
 *
 * @param a - 補間元のストロークスタイル
 * @param b - 補間先のストロークスタイル
 */
export const createStrokeLerp = (
  a: StrokeStyle | undefined,
  b: StrokeStyle | undefined,
): ((t: number) => StrokeStyle | undefined) => {
  if (!a && !b) return () => undefined

  const widthA = a?.width
  const widthB = b?.width
  const staticWidth = widthA ?? widthB

  const aColor = a?.color
  const bColor = b?.color
  const colorInterp = aColor !== undefined && bColor !== undefined ? createColorLerp(aColor, bColor) : undefined
  const staticColor = aColor ?? bColor

  const [aGrad, bGrad] = resolveGradientPair(a, b)
  const gradientInterp = aGrad && bGrad ? createGradientLerp(aGrad, bGrad) : undefined

  return (t: number): StrokeStyle | undefined => {
    const width = widthA !== undefined && widthB !== undefined ? lerp(widthA, widthB, t) : staticWidth
    const color = colorInterp ? colorInterp(t) : staticColor
    const gradient = gradientInterp ? gradientInterp(t) : undefined

    return {
      ...(width !== undefined && { width }),
      ...(color !== undefined && { color }),
      ...(gradient !== undefined && { gradient }),
    }
  }
}

/**
 * 2 つの {@link StyledBezierPath} を補間する関数を返す。
 *
 * パスの形状({@link BezierPath})とストロークスタイル(width, color, gradient)
 * の両方を補間する。セグメント数が異なる場合は内部で `matchSegmentCount`
 * により自動調整される。
 *
 * ストロークの補間は構築時に事前計算されるため、毎フレームは数値 `lerp` と
 * `toHexColor` のみで済む。
 *
 * 型パラメータ `P` は `Point2D` の派生に制約される(2D 限定)。
 *
 * @param from - 補間元
 * @param to - 補間先
 * @returns `t` を受け取り補間後の {@link StyledBezierPath} を返す関数
 */
export const createStyledPathInterpolator = <P extends Point2D = Point2D>(
  from: StyledBezierPath<P>,
  to: StyledBezierPath<NoInfer<P>>,
): ((t: number) => StyledBezierPath<P>) => {
  const interpPath = createPathInterpolator(from.path, to.path)
  const interpStroke = createStrokeLerp(from.stroke, to.stroke)

  return (t: number): StyledBezierPath<P> => {
    const stroke = interpStroke(t)
    return {
      path: interpPath(t),
      ...(stroke !== undefined && { stroke }),
    }
  }
}
