import { describe, expect, it } from 'vitest'
import type { Point2D, Point3D } from '../../src/types'
import { fromCatmullRom, fromPolyline } from '../../src/path/from'
import { createPathInterpolator } from '../../src/path/interpolate'
import { pointAtLength } from '../../src/path-query'
import { expectPointClose } from '../helpers'

describe('fromPolyline (2D)', () => {
  it('2 点から 1 セグメントのパスを作る', () => {
    const path = fromPolyline<Point2D>([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ])
    expect(path.segments).toHaveLength(1)
    expectPointClose(path.start, { x: 0, y: 0 })
    expectPointClose(path.segments[0]!.end, { x: 100, y: 0 })
    expectPointClose(path.segments[0]!.cp1, { x: 0, y: 0 })
    expectPointClose(path.segments[0]!.cp2, { x: 100, y: 0 })
  })

  it('N 点から N-1 セグメント', () => {
    const path = fromPolyline<Point2D>([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ])
    expect(path.segments).toHaveLength(3)
  })

  it('pointAtLength と組み合わせて水平移動が取れる', () => {
    const path = fromPolyline<Point2D>([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ])
    expectPointClose(pointAtLength(path, 0.5), { x: 50, y: 0 }, 1)
  })

  it('1 点以下では throw', () => {
    expect(() => fromPolyline<Point2D>([])).toThrow()
    expect(() => fromPolyline<Point2D>([{ x: 0, y: 0 }])).toThrow()
  })
})

describe('fromPolyline (3D)', () => {
  it('3D 点列から z を保持したパスを作る', () => {
    const path = fromPolyline<Point3D>([
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 20, z: 30 },
    ])
    expect(path.start.z).toBe(0)
    expect(path.segments[0]!.end.z).toBe(30)
    // 退化 3 次: cp1 は始点、cp2 は終点
    expect(path.segments[0]!.cp1.z).toBe(0)
    expect(path.segments[0]!.cp2.z).toBe(30)
  })
})

describe('fromCatmullRom (2D)', () => {
  const pts: readonly Point2D[] = [
    { x: 0, y: 0 },
    { x: 100, y: 100 },
    { x: 200, y: 0 },
    { x: 300, y: 100 },
  ]

  it('N 点から N-1 セグメントのパスを作る', () => {
    const path = fromCatmullRom(pts)
    expect(path.segments).toHaveLength(pts.length - 1)
  })

  it('始点は points[0]、各 end は元の点に一致', () => {
    const path = fromCatmullRom(pts)
    expectPointClose(path.start, pts[0]!)
    path.segments.forEach((seg, i) => {
      expectPointClose(seg.end, pts[i + 1]!)
    })
  })

  it('createPathInterpolator で別形状と補間できる', () => {
    const pathA = fromCatmullRom(pts)
    const pathB = fromCatmullRom<Point2D>([
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 200, y: 50 },
      { x: 300, y: 50 },
    ])
    const interp = createPathInterpolator(pathA, pathB)
    const mid = interp(0.5)
    expect(Number.isFinite(mid.start.x)).toBe(true)
    expect(mid.segments).toHaveLength(pathA.segments.length)
  })

  it('tension を小さくすると制御点が始点・終点に近づく', () => {
    const t1 = fromCatmullRom(pts, { tension: 1 })
    const t0 = fromCatmullRom(pts, { tension: 0 })
    expectPointClose(t0.segments[0]!.cp1, t0.start)
    expect(t1.segments[0]!.cp1.x).not.toBeCloseTo(t1.start.x, 2)
  })

  it('1 点以下では throw', () => {
    expect(() => fromCatmullRom<Point2D>([])).toThrow()
    expect(() => fromCatmullRom<Point2D>([{ x: 0, y: 0 }])).toThrow()
  })
})

describe('fromCatmullRom (3D)', () => {
  const pts3d: readonly Point3D[] = [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 10, z: 10 },
    { x: 20, y: 0, z: 20 },
    { x: 30, y: 10, z: 30 },
  ]

  it('z 成分が各 end に保持される', () => {
    const path = fromCatmullRom(pts3d)
    path.segments.forEach((seg, i) => {
      expect(seg.end.z).toBe(pts3d[i + 1]!.z)
    })
  })

  it('制御点 cp1 / cp2 も z を持つ', () => {
    const path = fromCatmullRom(pts3d)
    expect('z' in path.segments[0]!.cp1).toBe(true)
    expect('z' in path.segments[0]!.cp2).toBe(true)
  })
})
