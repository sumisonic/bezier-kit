import type { BezierPath, Point } from '../types'

/**
 * パスの全ての制御点(`start` と各セグメントの `cp1` / `cp2` / `end`)に
 * 関数 `fn` を適用し、同じトポロジの新しいパスを返す(Functor)。
 *
 * 次元変換・平行移動・スケール・回転など、座標レベルの任意の変換を 1 つの
 * API で表現する。副作用なし、全ての点が独立に変換される。
 *
 * 典型的な使い方:
 *
 * ```ts
 * // 2D → 3D (z=0 を付加)
 * const path3d = mapPoints<Point2D, Point3D>(path2d, (p) => ({ ...p, z: 0 }))
 *
 * // 3D → 2D (z を捨てる)
 * const path2d = mapPoints<Point3D, Point2D>(path3d, ({ x, y }) => ({ x, y }))
 *
 * // 平行移動(同次元)
 * const shifted = mapPoints(path, (p) => ({ ...p, x: p.x + 10 }))
 * ```
 *
 * @param path - 元のパス
 * @param fn - 各点に適用する変換関数
 * @returns 変換後のパス(次元は `Q` に従う)
 */
export const mapPoints = <P extends Point, Q extends Point>(path: BezierPath<P>, fn: (p: P) => Q): BezierPath<Q> => ({
  start: fn(path.start),
  segments: path.segments.map((seg) => ({
    cp1: fn(seg.cp1),
    cp2: fn(seg.cp2),
    end: fn(seg.end),
  })),
})
