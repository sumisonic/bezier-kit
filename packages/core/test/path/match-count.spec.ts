import { describe, expect, it } from 'vitest'
import type { BezierPath, Point2D, Point3D } from '../../src/types'
import { matchSegmentCount } from '../../src/path/match-count'
import { segmentLength } from '../../src/segment'
import { expectPointClose } from '../helpers'

const pathA: BezierPath<Point2D> = {
  start: { x: 0, y: 0 },
  segments: [
    { cp1: { x: 0, y: 50 }, cp2: { x: 50, y: 50 }, end: { x: 50, y: 0 } },
    { cp1: { x: 50, y: -50 }, cp2: { x: 100, y: -50 }, end: { x: 100, y: 0 } },
  ],
}

const pathB: BezierPath<Point2D> = {
  start: { x: 0, y: 0 },
  segments: [
    { cp1: { x: 0, y: 80 }, cp2: { x: 40, y: 80 }, end: { x: 40, y: 0 } },
    { cp1: { x: 40, y: -80 }, cp2: { x: 80, y: -80 }, end: { x: 80, y: 0 } },
    { cp1: { x: 80, y: 80 }, cp2: { x: 120, y: 80 }, end: { x: 120, y: 0 } },
    { cp1: { x: 120, y: -80 }, cp2: { x: 160, y: -80 }, end: { x: 160, y: 0 } },
    { cp1: { x: 160, y: 80 }, cp2: { x: 200, y: 80 }, end: { x: 200, y: 0 } },
  ],
}

const totalArcLength2D = (p: BezierPath<Point2D>): number =>
  p.segments.reduce<{ readonly sum: number; readonly prev: Point2D }>(
    (acc, seg) => ({ sum: acc.sum + segmentLength(acc.prev, seg), prev: seg.end }),
    { sum: 0, prev: p.start },
  ).sum

describe('matchSegmentCount (2D)', () => {
  it('同じセグメント数のパスはそのまま返す', () => {
    const [a, b] = matchSegmentCount(pathA, pathA)
    expect(a.segments).toHaveLength(pathA.segments.length)
    expect(b.segments).toHaveLength(pathA.segments.length)
  })

  it('セグメント数が多い方に揃える', () => {
    const [a, b] = matchSegmentCount(pathA, pathB)
    expect(a.segments).toHaveLength(pathB.segments.length)
    expect(b.segments).toHaveLength(pathB.segments.length)
  })

  it('逆順でも同じセグメント数になる', () => {
    const [b, a] = matchSegmentCount(pathB, pathA)
    expect(a.segments).toHaveLength(pathB.segments.length)
    expect(b.segments).toHaveLength(pathB.segments.length)
  })

  it('始点は変わらない', () => {
    const [a] = matchSegmentCount(pathA, pathB)
    expectPointClose(a.start, pathA.start)
  })

  it('終点は変わらない', () => {
    const [a] = matchSegmentCount(pathA, pathB)
    const lastSeg = a.segments[a.segments.length - 1]!
    expectPointClose(lastSeg.end, pathA.segments[pathA.segments.length - 1]!.end)
  })

  it('分割後の弧長は元の弧長に近い', () => {
    const originalLength = totalArcLength2D(pathA)
    const [adjusted] = matchSegmentCount(pathA, pathB)
    const adjustedLength = totalArcLength2D(adjusted)
    expect(adjustedLength).toBeCloseTo(originalLength, 0)
  })
})

describe('matchSegmentCount (3D)', () => {
  const a3d: BezierPath<Point3D> = {
    start: { x: 0, y: 0, z: 0 },
    segments: [{ cp1: { x: 0, y: 50, z: 10 }, cp2: { x: 50, y: 50, z: 20 }, end: { x: 50, y: 0, z: 30 } }],
  }
  const b3d: BezierPath<Point3D> = {
    start: { x: 0, y: 0, z: 0 },
    segments: [
      { cp1: { x: 0, y: 10, z: 0 }, cp2: { x: 10, y: 10, z: 0 }, end: { x: 10, y: 0, z: 0 } },
      { cp1: { x: 10, y: -10, z: 5 }, cp2: { x: 20, y: -10, z: 10 }, end: { x: 20, y: 0, z: 15 } },
      { cp1: { x: 20, y: 10, z: 20 }, cp2: { x: 30, y: 10, z: 25 }, end: { x: 30, y: 0, z: 30 } },
    ],
  }

  it('3D パスのセグメント数も揃う', () => {
    const [a, b] = matchSegmentCount(a3d, b3d)
    expect(a.segments).toHaveLength(b3d.segments.length)
    expect(b.segments).toHaveLength(b3d.segments.length)
  })

  it('3D: 始点と終点の z が保たれる', () => {
    const [a] = matchSegmentCount(a3d, b3d)
    expect(a.start.z).toBe(0)
    expect(a.segments[a.segments.length - 1]!.end.z).toBe(30)
  })
})
