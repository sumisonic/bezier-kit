import { describe, expect, it } from 'vitest'
import type { BezierPath, Point2D, Point3D } from '../../src/types'
import { mapPoints } from '../../src/path/map-points'

const path2d: BezierPath<Point2D> = {
  start: { x: 1, y: 2 },
  segments: [
    { cp1: { x: 3, y: 4 }, cp2: { x: 5, y: 6 }, end: { x: 7, y: 8 } },
    { cp1: { x: 9, y: 10 }, cp2: { x: 11, y: 12 }, end: { x: 13, y: 14 } },
  ],
}

describe('mapPoints', () => {
  it('同次元の平行移動', () => {
    const shifted = mapPoints<Point2D, Point2D>(path2d, (p) => ({ x: p.x + 100, y: p.y + 200 }))
    expect(shifted.start).toEqual({ x: 101, y: 202 })
    expect(shifted.segments[0]!.cp1).toEqual({ x: 103, y: 204 })
    expect(shifted.segments[0]!.end).toEqual({ x: 107, y: 208 })
  })

  it('スケール変換', () => {
    const scaled = mapPoints<Point2D, Point2D>(path2d, (p) => ({ x: p.x * 2, y: p.y * 3 }))
    expect(scaled.start).toEqual({ x: 2, y: 6 })
    expect(scaled.segments[0]!.end).toEqual({ x: 14, y: 24 })
  })

  it('2D → 3D 変換(z=0 付加)', () => {
    const path3d: BezierPath<Point3D> = mapPoints<Point2D, Point3D>(path2d, (p) => ({ x: p.x, y: p.y, z: 0 }))
    expect(path3d.start).toEqual({ x: 1, y: 2, z: 0 })
    expect(path3d.segments[0]!.cp1.z).toBe(0)
    expect(path3d.segments[1]!.end.z).toBe(0)
  })

  it('2D → 3D 変換(z = x として付加)', () => {
    const path3d: BezierPath<Point3D> = mapPoints<Point2D, Point3D>(path2d, (p) => ({
      x: p.x,
      y: p.y,
      z: p.x,
    }))
    expect(path3d.start).toEqual({ x: 1, y: 2, z: 1 })
    expect(path3d.segments[1]!.end).toEqual({ x: 13, y: 14, z: 13 })
  })

  it('3D → 2D 変換(z を捨てる)', () => {
    const src: BezierPath<Point3D> = {
      start: { x: 1, y: 2, z: 100 },
      segments: [{ cp1: { x: 3, y: 4, z: 101 }, cp2: { x: 5, y: 6, z: 102 }, end: { x: 7, y: 8, z: 103 } }],
    }
    const dst: BezierPath<Point2D> = mapPoints<Point3D, Point2D>(src, ({ x, y }) => ({ x, y }))
    expect(dst.start).toEqual({ x: 1, y: 2 })
    expect(dst.segments[0]!.end).toEqual({ x: 7, y: 8 })
    expect('z' in dst.start).toBe(false)
  })

  it('空セグメントのパスでも動作する', () => {
    const empty: BezierPath<Point2D> = { start: { x: 0, y: 0 }, segments: [] }
    const result = mapPoints<Point2D, Point2D>(empty, (p) => ({ x: p.x + 1, y: p.y + 1 }))
    expect(result.start).toEqual({ x: 1, y: 1 })
    expect(result.segments).toHaveLength(0)
  })

  it('トポロジ(セグメント数)が保たれる', () => {
    const result = mapPoints<Point2D, Point2D>(path2d, (p) => p)
    expect(result.segments).toHaveLength(path2d.segments.length)
  })
})
