import type { BBox2D, Point2D } from '@sumisonic/bezier-kit-core'
import type { LinearGradient } from './types'

/**
 * グラデーションの `objectBoundingBox`(0〜1)座標を、指定 `bbox` に基づいて
 * 絶対座標に変換する。
 *
 * style パッケージは 2D 限定のため、{@link BBox2D} を受け取る。
 *
 * @param gradient - `objectBoundingBox` 基準のグラデーション
 * @param bbox - 変換の基準となるバウンディングボックス(2D)
 * @returns `start`(x1, y1)と `end`(x2, y2)の絶対座標
 */
export const gradientToAbsolute = (
  gradient: LinearGradient,
  bbox: BBox2D,
): { readonly start: Point2D; readonly end: Point2D } => ({
  start: {
    x: bbox.minX + gradient.x1 * bbox.width,
    y: bbox.minY + gradient.y1 * bbox.height,
  },
  end: {
    x: bbox.minX + gradient.x2 * bbox.width,
    y: bbox.minY + gradient.y2 * bbox.height,
  },
})

/**
 * グラデーション座標を元の `bbox` から新しい `bbox` へ再マッピングする。
 *
 * `objectBoundingBox`(0〜1)→ 絶対座標 → 新 `bbox` での `objectBoundingBox`(0〜1)
 * の 3 段階で変換する。分割後のサブパス等に対してグラデーションの見た目を
 * 維持したい場合に用いる。
 *
 * @param gradient - 元のグラデーション
 * @param origBBox - 元の bbox(2D)
 * @param newBBox - 新しい bbox(2D)
 */
export const remapGradient = (gradient: LinearGradient, origBBox: BBox2D, newBBox: BBox2D): LinearGradient => {
  const { start, end } = gradientToAbsolute(gradient, origBBox)
  const nw = newBBox.width || 1
  const nh = newBBox.height || 1

  return {
    x1: (start.x - newBBox.minX) / nw,
    y1: (start.y - newBBox.minY) / nh,
    x2: (end.x - newBBox.minX) / nw,
    y2: (end.y - newBBox.minY) / nh,
    stops: gradient.stops,
  }
}
