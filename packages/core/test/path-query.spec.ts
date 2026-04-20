import { describe, expect, it } from 'vitest'
import type { BezierPath, Point2D, Point3D } from '../src/types'
import { pointAtLength, tangentAtLength } from '../src/path-query'
import { fromPolyline } from '../src/path/from'
import { expectPointClose } from './helpers'

const linePath: BezierPath<Point2D> = fromPolyline<Point2D>([
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 200, y: 0 },
])

describe('pointAtLength (2D)', () => {
  it('ratio=0 で始点を返す', () => {
    expectPointClose(pointAtLength(linePath, 0), { x: 0, y: 0 })
  })

  it('ratio=1 で終点を返す', () => {
    expectPointClose(pointAtLength(linePath, 1), { x: 200, y: 0 })
  })

  it('ratio=0.5 で中央(x=100)', () => {
    expectPointClose(pointAtLength(linePath, 0.5), { x: 100, y: 0 }, 1)
  })

  it('ratio 範囲外は clamp される', () => {
    expectPointClose(pointAtLength(linePath, -1), { x: 0, y: 0 })
    expectPointClose(pointAtLength(linePath, 2), { x: 200, y: 0 })
  })

  it('空セグメントのパスで throw', () => {
    const empty: BezierPath<Point2D> = { start: { x: 0, y: 0 }, segments: [] }
    expect(() => pointAtLength(empty, 0.5)).toThrow()
  })
})

describe('pointAtLength (3D)', () => {
  it('3D 対角パス上の点を返す', () => {
    const path3d = fromPolyline<Point3D>([
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 20, z: 30 },
    ])
    const p = pointAtLength(path3d, 0.5)
    expect(p.x).toBeCloseTo(5, 1)
    expect(p.y).toBeCloseTo(10, 1)
    expect(p.z).toBeCloseTo(15, 1)
  })
})

describe('tangentAtLength (2D)', () => {
  it('水平直線パスの接線は x 軸向き', () => {
    const v = tangentAtLength(linePath, 0.5)
    expect(Math.atan2(v.y, v.x)).toBeCloseTo(0, 6)
  })

  it('垂直に下る直線パスの接線は y+', () => {
    const path = fromPolyline<Point2D>([
      { x: 0, y: 0 },
      { x: 0, y: 100 },
    ])
    const v = tangentAtLength(path, 0.5)
    expect(Math.atan2(v.y, v.x)).toBeCloseTo(Math.PI / 2, 6)
  })

  it('45° の直線パスの接線角度は π/4', () => {
    const path = fromPolyline<Point2D>([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ])
    const v = tangentAtLength(path, 0.5)
    expect(Math.atan2(v.y, v.x)).toBeCloseTo(Math.PI / 4, 6)
  })

  it('空セグメントのパスで throw', () => {
    const empty: BezierPath<Point2D> = { start: { x: 0, y: 0 }, segments: [] }
    expect(() => tangentAtLength(empty, 0.5)).toThrow()
  })
})

describe('tangentAtLength (3D)', () => {
  it('z 軸沿いの直線パスで接線が z+ 方向', () => {
    const path = fromPolyline<Point3D>([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 100 },
    ])
    const v = tangentAtLength(path, 0.5)
    const len = Math.hypot(v.x, v.y, v.z)
    expect(v.z / len).toBeCloseTo(1, 6)
    expect(v.x).toBeCloseTo(0, 6)
    expect(v.y).toBeCloseTo(0, 6)
  })

  it('3D 対角線パスの接線が対角方向', () => {
    const path = fromPolyline<Point3D>([
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 4, z: 12 },
    ])
    const v = tangentAtLength(path, 0.5)
    const len = Math.hypot(v.x, v.y, v.z)
    expect(v.x / len).toBeCloseTo(3 / 13, 4)
    expect(v.y / len).toBeCloseTo(4 / 13, 4)
    expect(v.z / len).toBeCloseTo(12 / 13, 4)
  })
})
