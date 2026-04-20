import { describe, expect, it } from 'vitest'
import type { BezierPath, Point2D, Point3D } from '../../src/types'
import { createPathInterpolator, createPathInterpolatorStrict } from '../../src/path/interpolate'
import { expectPointClose } from '../helpers'

const pathA: BezierPath<Point2D> = {
  start: { x: 0, y: 0 },
  segments: [
    { cp1: { x: 0, y: 50 }, cp2: { x: 50, y: 50 }, end: { x: 50, y: 0 } },
    { cp1: { x: 50, y: -50 }, cp2: { x: 100, y: -50 }, end: { x: 100, y: 0 } },
  ],
}

const pathB: BezierPath<Point2D> = {
  start: { x: 10, y: 10 },
  segments: [
    { cp1: { x: 10, y: 60 }, cp2: { x: 60, y: 60 }, end: { x: 60, y: 10 } },
    { cp1: { x: 60, y: -40 }, cp2: { x: 110, y: -40 }, end: { x: 110, y: 10 } },
  ],
}

describe('createPathInterpolatorStrict (2D)', () => {
  it('t=0 で from を返す', () => {
    const interp = createPathInterpolatorStrict(pathA, pathB)
    const result = interp(0)
    expectPointClose(result.start, pathA.start)
    expectPointClose(result.segments[0]!.end, pathA.segments[0]!.end)
    expectPointClose(result.segments[1]!.end, pathA.segments[1]!.end)
  })

  it('t=1 で to を返す', () => {
    const interp = createPathInterpolatorStrict(pathA, pathB)
    const result = interp(1)
    expectPointClose(result.start, pathB.start)
    expectPointClose(result.segments[0]!.end, pathB.segments[0]!.end)
    expectPointClose(result.segments[1]!.end, pathB.segments[1]!.end)
  })

  it('t=0.5 で中間値を返す', () => {
    const interp = createPathInterpolatorStrict(pathA, pathB)
    const result = interp(0.5)
    expectPointClose(result.start, { x: 5, y: 5 })
    expectPointClose(result.segments[0]!.end, { x: 55, y: 5 })
  })

  it('t > 1 / t < 0 でも外挿される(Back/Elastic 対応)', () => {
    const interp = createPathInterpolatorStrict(pathA, pathB)
    const above = interp(1.2)
    const below = interp(-0.2)
    expect(Number.isFinite(above.start.x)).toBe(true)
    expect(Number.isFinite(below.start.x)).toBe(true)
  })

  it('セグメント数が異なるとエラーをスローする', () => {
    const short: BezierPath<Point2D> = {
      start: { x: 0, y: 0 },
      segments: [{ cp1: { x: 10, y: 10 }, cp2: { x: 20, y: 10 }, end: { x: 30, y: 0 } }],
    }
    expect(() => createPathInterpolatorStrict(pathA, short)).toThrow('Segment count mismatch')
  })
})

describe('createPathInterpolator (2D)', () => {
  it('セグメント数が異なるパスでも補間できる', () => {
    const short: BezierPath<Point2D> = {
      start: { x: 0, y: 0 },
      segments: [{ cp1: { x: 30, y: 50 }, cp2: { x: 70, y: 50 }, end: { x: 100, y: 0 } }],
    }
    const interp = createPathInterpolator(pathA, short)
    const result = interp(0.5)
    expect(result.segments).toHaveLength(2)
  })

  it('t=0 で from の始点に一致', () => {
    const interp = createPathInterpolator(pathA, pathB)
    const result = interp(0)
    expectPointClose(result.start, pathA.start)
  })

  it('t=1 で to の始点に一致', () => {
    const interp = createPathInterpolator(pathA, pathB)
    const result = interp(1)
    expectPointClose(result.start, pathB.start)
  })
})

describe('createPathInterpolator (3D)', () => {
  const a3d: BezierPath<Point3D> = {
    start: { x: 0, y: 0, z: 0 },
    segments: [{ cp1: { x: 10, y: 10, z: 0 }, cp2: { x: 20, y: 10, z: 0 }, end: { x: 30, y: 0, z: 0 } }],
  }
  const b3d: BezierPath<Point3D> = {
    start: { x: 0, y: 0, z: 100 },
    segments: [{ cp1: { x: 10, y: 0, z: 100 }, cp2: { x: 20, y: 0, z: 100 }, end: { x: 30, y: 0, z: 100 } }],
  }

  it('t=0.5 で z が中間値', () => {
    const interp = createPathInterpolator(a3d, b3d)
    const result = interp(0.5)
    expect(result.start.z).toBe(50)
    expect(result.segments[0]!.end.z).toBe(50)
  })

  it('t=0 で from の z', () => {
    const interp = createPathInterpolator(a3d, b3d)
    const result = interp(0)
    expect(result.start.z).toBe(0)
  })

  it('t=1 で to の z', () => {
    const interp = createPathInterpolator(a3d, b3d)
    const result = interp(1)
    expect(result.start.z).toBe(100)
  })
})
