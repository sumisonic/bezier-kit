/**
 * 2 次元座標。
 *
 * `__dim` は optional のファントムフィールドで、ランタイムでは書かない(値を持たない)。
 * これは TypeScript の**構造的部分型**により `Point3D`({x, y, z})が `Point2D`({x, y})として
 * 受け入れられてしまうのを防ぐための区別印で、型エラーを発生させるためだけに存在する。
 */
export type Point2D = {
  readonly x: number
  readonly y: number
  readonly __dim?: '2d'
}

/**
 * 3 次元座標。`Point2D` に `z` 軸を追加したもの。
 * `__dim` ファントムフィールドで `Point2D` と型的に非互換にしている。
 */
export type Point3D = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly __dim?: '3d'
}

/**
 * 2D / 3D の点の union。
 *
 * bezier-kit の公開 API は `<P extends Point>` の型パラメータを伝播し、
 * ユーザーは `Point2D` / `Point3D` を明示して(デフォルト型パラメータは
 * 持たせていない)次元を混在させない設計。
 */
export type Point = Point2D | Point3D

/**
 * 3 次ベジェ曲線の 1 セグメント。
 *
 * 始点は保持せず、前のセグメントの `end`(または {@link BezierPath.start})が担う。
 * `cp1` / `cp2` は 2 つの制御点、`end` はセグメントの終点。
 * 型パラメータ `P` は 2D / 3D の次元を選択する(`Point2D` or `Point3D`)。
 */
export type BezierSegment<P extends Point> = {
  readonly cp1: P
  readonly cp2: P
  readonly end: P
}

/**
 * 3 次ベジェ曲線のパス。
 *
 * SVG の `M start C cp1 cp2 end ...` や Canvas / pixi.js の
 * `moveTo(start) → bezierCurveTo(cp1, cp2, end)` にそのまま対応する。
 * 型パラメータ `P` は 2D / 3D の次元を選択する。
 */
export type BezierPath<P extends Point> = {
  readonly start: P
  readonly segments: readonly BezierSegment<P>[]
}
