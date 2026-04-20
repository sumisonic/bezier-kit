import type { BezierPath, BezierSegment, Point, Point3D } from '../types'

/**
 * {@link fromCatmullRom} のオプション。
 */
export type CatmullRomOptions = {
  /**
   * スプラインのテンション。1 で標準的な Catmull-Rom、値が小さいと制御点が
   * 始点・終点に引き寄せられる(= カーブが緩くなる)。デフォルト: 1
   */
  readonly tension?: number
}

const is3D = (p: Point): p is Point3D => 'z' in p

/**
 * 通過点列(例: マウス軌跡、等間隔サンプル)から Catmull-Rom スプラインを
 * 3 次ベジェで表現した {@link BezierPath} を生成する。
 *
 * 端点では進行方向が水平に近くなる仮想点を両端に追加する(標準的な端点処理)。
 *
 * 2D / 3D 両対応。入力点の次元が出力パスの次元に一致する。
 *
 * 実装内の `as unknown as P` は、`is3D` で実行時に型を振り分けていても
 * TypeScript のジェネリクス型パラメータ `P` が narrow されない制約を回避するため。
 * ランタイムでは `P` と一致するオブジェクトを返している。
 *
 * @param points - 通過点の配列(最低 2 点)
 * @param options - テンション等のオプション
 * @throws `points.length < 2` の場合
 */
export const fromCatmullRom = <P extends Point>(
  points: readonly P[],
  options: CatmullRomOptions = {},
): BezierPath<P> => {
  if (points.length < 2) {
    throw new Error(`fromCatmullRom: at least 2 points required (got ${points.length})`)
  }

  const tension = options.tension ?? 1
  const first = points[0]!
  const last = points[points.length - 1]!
  const extended = [first, ...points, last]

  const segments: BezierSegment<P>[] = extended.flatMap((current, i, arr) => {
    if (i === 0 || i >= arr.length - 2) return []
    const prev = arr[i - 1]!
    const next = arr[i + 1]!
    const nextNext = arr[i + 2] ?? next

    const cp1x = current.x + ((next.x - prev.x) / 6) * tension
    const cp1y = current.y + ((next.y - prev.y) / 6) * tension
    const cp2x = next.x - ((nextNext.x - current.x) / 6) * tension
    const cp2y = next.y - ((nextNext.y - current.y) / 6) * tension

    if (is3D(current) && is3D(prev) && is3D(next) && is3D(nextNext)) {
      const cp1z = current.z + ((next.z - prev.z) / 6) * tension
      const cp2z = next.z - ((nextNext.z - current.z) / 6) * tension
      const cp1 = { x: cp1x, y: cp1y, z: cp1z } as unknown as P
      const cp2 = { x: cp2x, y: cp2y, z: cp2z } as unknown as P
      return [{ cp1, cp2, end: next }]
    }

    const cp1 = { x: cp1x, y: cp1y } as unknown as P
    const cp2 = { x: cp2x, y: cp2y } as unknown as P
    return [{ cp1, cp2, end: next }]
  })

  return { start: first, segments }
}

/**
 * 直線列(折れ線)から {@link BezierPath} を生成する。
 *
 * 各区間を退化 3 次ベジェ(`cp1` = 始点、`cp2` = 終点)として表現するため、
 * 曲線 API(`pointAt`, `splitSegmentAt`, `createPathInterpolator` 等)に
 * そのまま渡せる。
 *
 * 2D / 3D 両対応。
 *
 * @param points - 点列(最低 2 点)
 * @throws `points.length < 2` の場合
 */
export const fromPolyline = <P extends Point>(points: readonly P[]): BezierPath<P> => {
  if (points.length < 2) {
    throw new Error(`fromPolyline: at least 2 points required (got ${points.length})`)
  }

  const start = points[0]!
  const segments: readonly BezierSegment<P>[] = points.slice(1).map((end, i) => {
    const prev = points[i]!
    return { cp1: prev, cp2: end, end }
  })

  return { start, segments }
}
