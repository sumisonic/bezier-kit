import type { BezierPath, Point2D } from '@sumisonic/bezier-kit-core'

/**
 * 線形グラデーションの色停止点。
 * `offset` は 0〜1 の範囲で、`color` は `#rrggbb` 形式。
 */
export type GradientStop = {
  readonly offset: number
  readonly color: string
}

/**
 * 線形グラデーション。
 *
 * 座標 `(x1, y1)` → `(x2, y2)` は `objectBoundingBox`(0〜1)基準で指定する。
 * 絶対座標に変換するには {@link import('./gradient').gradientToAbsolute} を用いる。
 *
 * グラデーションは 2D 概念のため、style パッケージ全体が `<P extends Point2D>` に制約される。
 */
export type LinearGradient = {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly stops: readonly GradientStop[]
}

/**
 * ストロークスタイル(線幅・単色・グラデーション)。
 *
 * 単色(`color`)とグラデーション(`gradient`)は共存してもよいが、通常は
 * どちらか一方を指定する。両方 `undefined` のときは描画側の既定値を使う。
 */
export type StrokeStyle = {
  readonly width?: number
  readonly color?: string
  readonly gradient?: LinearGradient
}

/**
 * ベジェパスにストロークスタイルを付加したもの。
 *
 * 型パラメータ `P` は `Point2D` の派生に制約される(style パッケージは 2D 限定)。
 * 3D パスを渡すと型エラーになる。
 */
export type StyledBezierPath<P extends Point2D = Point2D> = {
  readonly path: BezierPath<P>
  readonly stroke?: StrokeStyle
}

/**
 * SVG の `viewBox` に相当するサイズ情報。
 */
export type ViewBox = {
  readonly width: number
  readonly height: number
}

/**
 * `viewBox` とスタイル付きパス配列を持つ、SVG エクスポートに相当するデータ。
 */
export type StyledBezierData<P extends Point2D = Point2D> = {
  readonly viewBox: ViewBox
  readonly paths: readonly StyledBezierPath<P>[]
}
