import type { BezierPath, Point, Point3D } from './types'

/**
 * 2 次元バウンディングボックス。`x` / `y` 範囲のみを持つ。
 */
export type BBox2D = {
  readonly minX: number
  readonly minY: number
  readonly width: number
  readonly height: number
}

/**
 * 3 次元バウンディングボックス。`x` / `y` / `z` 範囲を持つ。
 */
export type BBox3D = {
  readonly minX: number
  readonly minY: number
  readonly minZ: number
  readonly width: number
  readonly height: number
  readonly depth: number
}

/**
 * 入力の次元に応じて `BBox2D` / `BBox3D` を返す条件型。
 * `bbox<Point2D>(...)` は `BBox2D`、`bbox<Point3D>(...)` は `BBox3D` を返す。
 */
export type BBox<P extends Point> = P extends Point3D ? BBox3D : BBox2D

const is3D = (p: Point): p is Point3D => 'z' in p

/**
 * {@link BezierPath} の全制御点(`start` と各セグメントの `cp1` / `cp2` / `end`)から
 * バウンディングボックスを算出する。
 *
 * 3 次ベジェ曲線は制御点の凸包内に収まるため、本関数は**曲線上の正確な bbox 以上の範囲**
 * (= 上界)を返す。より厳密な bbox が必要な場合は将来の `exactBBox`(曲線極値を
 * 解析解で求める)を検討する。
 *
 * 戻り値の次元は入力 `P` の次元に連動する:
 * - `Point2D` 入力 → `BBox2D`
 * - `Point3D` 入力 → `BBox3D`
 *
 * @param path - 対象のパス
 */
export const bbox = <P extends Point>(path: BezierPath<P>): BBox<P> => {
  const allPoints: readonly P[] = [path.start, ...path.segments.flatMap((seg) => [seg.cp1, seg.cp2, seg.end])]
  const xs = allPoints.map((p) => p.x)
  const ys = allPoints.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const width = Math.max(...xs) - minX
  const height = Math.max(...ys) - minY

  if (is3D(path.start)) {
    const zs = (allPoints as readonly Point3D[]).map((p) => p.z)
    const minZ = Math.min(...zs)
    const depth = Math.max(...zs) - minZ
    return { minX, minY, minZ, width, height, depth } as BBox<P>
  }
  return { minX, minY, width, height } as BBox<P>
}
