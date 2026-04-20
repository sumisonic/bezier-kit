import { describe, expect, it } from 'vitest'
import { bbox } from '../src/bbox'
import type { BezierPath, Point2D, Point3D } from '../src/types'

describe('bbox (2D)', () => {
  it('1 セグメントのパスで正しい bbox を返す', () => {
    const path: BezierPath<Point2D> = {
      start: { x: 0, y: 0 },
      segments: [{ cp1: { x: 0, y: 100 }, cp2: { x: 100, y: 100 }, end: { x: 100, y: 0 } }],
    }
    const b = bbox(path)
    expect(b.minX).toBe(0)
    expect(b.minY).toBe(0)
    expect(b.width).toBe(100)
    expect(b.height).toBe(100)
  })

  it('始点のみ(セグメントなし)のパスで width / height が 0', () => {
    const path: BezierPath<Point2D> = { start: { x: 50, y: 30 }, segments: [] }
    const b = bbox(path)
    expect(b.minX).toBe(50)
    expect(b.minY).toBe(30)
    expect(b.width).toBe(0)
    expect(b.height).toBe(0)
  })

  it('直線パス(制御点が直線上)で height=0', () => {
    const path: BezierPath<Point2D> = {
      start: { x: 10, y: 20 },
      segments: [{ cp1: { x: 30, y: 20 }, cp2: { x: 50, y: 20 }, end: { x: 70, y: 20 } }],
    }
    const b = bbox(path)
    expect(b.minX).toBe(10)
    expect(b.minY).toBe(20)
    expect(b.width).toBe(60)
    expect(b.height).toBe(0)
  })

  it('負の座標を含むパス', () => {
    const path: BezierPath<Point2D> = {
      start: { x: -10, y: -20 },
      segments: [{ cp1: { x: 0, y: 50 }, cp2: { x: 30, y: -30 }, end: { x: 40, y: 10 } }],
    }
    const b = bbox(path)
    expect(b.minX).toBe(-10)
    expect(b.minY).toBe(-30)
    expect(b.width).toBe(50)
    expect(b.height).toBe(80)
  })

  it('複数セグメントで全制御点を考慮する', () => {
    const path: BezierPath<Point2D> = {
      start: { x: 0, y: 0 },
      segments: [
        { cp1: { x: 10, y: 200 }, cp2: { x: 20, y: 10 }, end: { x: 50, y: 0 } },
        { cp1: { x: 60, y: -100 }, cp2: { x: 300, y: 10 }, end: { x: 100, y: 0 } },
      ],
    }
    const b = bbox(path)
    expect(b.minX).toBe(0)
    expect(b.minY).toBe(-100)
    expect(b.width).toBe(300)
    expect(b.height).toBe(300)
  })

  it('2D 入力では minZ / depth を持たない', () => {
    const path: BezierPath<Point2D> = { start: { x: 0, y: 0 }, segments: [] }
    const b = bbox(path)
    expect('minZ' in b).toBe(false)
    expect('depth' in b).toBe(false)
  })
})

describe('bbox (3D)', () => {
  it('3D セグメントで z 方向も含む bbox を返す', () => {
    const path: BezierPath<Point3D> = {
      start: { x: 0, y: 0, z: 0 },
      segments: [{ cp1: { x: 10, y: 20, z: 5 }, cp2: { x: 20, y: 30, z: 15 }, end: { x: 30, y: 40, z: 25 } }],
    }
    const b = bbox(path)
    expect(b.minX).toBe(0)
    expect(b.minY).toBe(0)
    expect(b.minZ).toBe(0)
    expect(b.width).toBe(30)
    expect(b.height).toBe(40)
    expect(b.depth).toBe(25)
  })

  it('z 軸方向の負値も考慮される', () => {
    const path: BezierPath<Point3D> = {
      start: { x: 0, y: 0, z: -10 },
      segments: [{ cp1: { x: 0, y: 0, z: 0 }, cp2: { x: 0, y: 0, z: 20 }, end: { x: 0, y: 0, z: 30 } }],
    }
    const b = bbox(path)
    expect(b.minZ).toBe(-10)
    expect(b.depth).toBe(40)
  })

  it('3D 入力では BBox3D として minZ / depth を含む', () => {
    const path: BezierPath<Point3D> = { start: { x: 1, y: 2, z: 3 }, segments: [] }
    const b = bbox(path)
    expect(b.minZ).toBe(3)
    expect(b.depth).toBe(0)
  })
})
