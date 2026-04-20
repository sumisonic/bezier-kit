/**
 * @sumisonic/bezier-kit-core
 *
 * 依存ゼロの 2D / 3D 3 次ベジェ曲線ライブラリ(幾何学層)。
 *
 * `<P extends Point>` のジェネリクスが API に貫通しており、`Point2D` / `Point3D`
 * を明示的に指定することで次元を選択する。2 つのパスの次元が異なる演算は型エラー。
 */

export type { Point, Point2D, Point3D, BezierSegment, BezierPath } from './types'
export type { BBox, BBox2D, BBox3D } from './bbox'
export type { ArcLengthOptions } from './segment'
export type { ArcLengthIndex, ArcLengthLocation } from './arc-length'
export type { CatmullRomOptions } from './path/from'

export { lerp, clamp, lerpPoint, distance, scan, binarySearchIndex } from './math'
export { bbox } from './bbox'
export { pointAt, tangentAt, splitSegmentAt, arcLengthTo, segmentLength, segmentStartPoints } from './segment'
export { createArcLengthIndex } from './arc-length'
export { arcLengthToParam } from './arc-length-param'
export { matchSegmentCount } from './path/match-count'
export { createPathInterpolator, createPathInterpolatorStrict } from './path/interpolate'
export { createPathSplitter } from './path/split'
export { fromCatmullRom, fromPolyline } from './path/from'
export { mapPoints } from './path/map-points'
export { pointAtLength, tangentAtLength } from './path-query'
