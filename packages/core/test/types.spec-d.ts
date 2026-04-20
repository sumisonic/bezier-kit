import { describe, expectTypeOf, it } from 'vitest'
import type { ArcLengthIndex, ArcLengthLocation, BBox2D, BBox3D, BezierPath, Point, Point2D, Point3D } from '../src'
import {
  bbox,
  createArcLengthIndex,
  createPathInterpolator,
  createPathInterpolatorStrict,
  createPathSplitter,
  fromCatmullRom,
  fromPolyline,
  mapPoints,
  pointAtLength,
  tangentAt,
  tangentAtLength,
} from '../src'

const dummy2d: BezierPath<Point2D> = {
  start: { x: 0, y: 0 },
  segments: [{ cp1: { x: 0, y: 1 }, cp2: { x: 1, y: 1 }, end: { x: 1, y: 0 } }],
}
const dummy3d: BezierPath<Point3D> = {
  start: { x: 0, y: 0, z: 0 },
  segments: [{ cp1: { x: 0, y: 1, z: 1 }, cp2: { x: 1, y: 1, z: 2 }, end: { x: 1, y: 0, z: 3 } }],
}

describe('type surface (2D)', () => {
  it('createPathInterpolator: (from, to) => (t: number) => BezierPath<Point2D>', () => {
    const interp = createPathInterpolator(dummy2d, dummy2d)
    expectTypeOf(interp).toEqualTypeOf<(t: number) => BezierPath<Point2D>>()
  })

  it('createPathInterpolatorStrict: same signature', () => {
    const interp = createPathInterpolatorStrict(dummy2d, dummy2d)
    expectTypeOf(interp).toEqualTypeOf<(t: number) => BezierPath<Point2D>>()
  })

  it('createPathSplitter: returns readonly tuple [BezierPath<Point2D>, BezierPath<Point2D>]', () => {
    const splitter = createPathSplitter(dummy2d)
    expectTypeOf(splitter).toEqualTypeOf<(ratio: number) => readonly [BezierPath<Point2D>, BezierPath<Point2D>]>()
  })

  it('createArcLengthIndex: ArcLengthIndex<Point2D>', () => {
    const idx = createArcLengthIndex(dummy2d)
    expectTypeOf(idx).toEqualTypeOf<ArcLengthIndex<Point2D>>()
    expectTypeOf(idx.locate).toEqualTypeOf<(ratio: number) => ArcLengthLocation>()
    expectTypeOf(idx.cumulativeLengths).toEqualTypeOf<readonly number[]>()
    expectTypeOf(idx.startPoints).toEqualTypeOf<readonly Point2D[]>()
  })

  it('bbox<Point2D>: BBox2D', () => {
    const b = bbox(dummy2d)
    expectTypeOf(b).toEqualTypeOf<BBox2D>()
  })

  it('pointAtLength: returns Point2D', () => {
    const p = pointAtLength(dummy2d, 0.5)
    expectTypeOf(p).toEqualTypeOf<Point2D>()
  })

  it('tangentAtLength: returns Point2D', () => {
    const v = tangentAtLength(dummy2d, 0.5)
    expectTypeOf(v).toEqualTypeOf<Point2D>()
  })

  it('tangentAt: returns Point2D', () => {
    const t = tangentAt(dummy2d.start, dummy2d.segments[0]!, 0.5)
    expectTypeOf(t).toEqualTypeOf<Point2D>()
  })
})

describe('type surface (3D)', () => {
  it('createPathInterpolator: 3D パスなら (t: number) => BezierPath<Point3D>', () => {
    const interp = createPathInterpolator(dummy3d, dummy3d)
    expectTypeOf(interp).toEqualTypeOf<(t: number) => BezierPath<Point3D>>()
  })

  it('bbox<Point3D>: BBox3D', () => {
    const b = bbox(dummy3d)
    expectTypeOf(b).toEqualTypeOf<BBox3D>()
  })

  it('pointAtLength<Point3D>: returns Point3D', () => {
    const p = pointAtLength(dummy3d, 0.5)
    expectTypeOf(p).toEqualTypeOf<Point3D>()
  })

  it('tangentAtLength<Point3D>: returns Point3D', () => {
    const v = tangentAtLength(dummy3d, 0.5)
    expectTypeOf(v).toEqualTypeOf<Point3D>()
  })
})

describe('type safety: dimension mismatch', () => {
  it('fromCatmullRom は入力の次元を保持', () => {
    const path2d = fromCatmullRom<Point2D>([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ])
    const path3d = fromCatmullRom<Point3D>([
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
    ])
    expectTypeOf(path2d).toEqualTypeOf<BezierPath<Point2D>>()
    expectTypeOf(path3d).toEqualTypeOf<BezierPath<Point3D>>()
  })

  it('2D と 3D の混在呼び出しは型エラーになる', () => {
    // @ts-expect-error - BezierPath<Point2D> と BezierPath<Point3D> は __dim ブランドで非互換
    createPathInterpolator(dummy2d, dummy3d)

    // @ts-expect-error - 逆方向も同じく型エラー
    createPathInterpolator(dummy3d, dummy2d)
  })
})

describe('mapPoints: Functor', () => {
  it('2D → 3D 変換の型', () => {
    const r = mapPoints<Point2D, Point3D>(dummy2d, (p) => ({ x: p.x, y: p.y, z: 0 }))
    expectTypeOf(r).toEqualTypeOf<BezierPath<Point3D>>()
  })

  it('3D → 2D 変換の型', () => {
    const r = mapPoints<Point3D, Point2D>(dummy3d, ({ x, y }) => ({ x, y }))
    expectTypeOf(r).toEqualTypeOf<BezierPath<Point2D>>()
  })

  it('同次元の変換は型が保たれる', () => {
    const r = mapPoints<Point2D, Point2D>(dummy2d, (p) => ({ x: p.x + 1, y: p.y + 1 }))
    expectTypeOf(r).toEqualTypeOf<BezierPath<Point2D>>()
  })
})

describe('fromPolyline: 入力次元を保持', () => {
  it('2D', () => {
    const r = fromPolyline<Point2D>([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ])
    expectTypeOf(r).toEqualTypeOf<BezierPath<Point2D>>()
  })

  it('3D', () => {
    const r = fromPolyline<Point3D>([
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
    ])
    expectTypeOf(r).toEqualTypeOf<BezierPath<Point3D>>()
  })
})

// Point は union なので typeof 判定が必要(参照用)
export type _PointUnion = Point
