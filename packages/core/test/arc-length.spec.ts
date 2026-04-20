import { describe, expect, it } from 'vitest'
import { createArcLengthIndex } from '../src/arc-length'
import type { BezierPath, Point2D, Point3D } from '../src/types'

const linePath: BezierPath<Point2D> = {
  start: { x: 0, y: 0 },
  segments: [
    { cp1: { x: 33, y: 0 }, cp2: { x: 67, y: 0 }, end: { x: 100, y: 0 } },
    { cp1: { x: 133, y: 0 }, cp2: { x: 167, y: 0 }, end: { x: 200, y: 0 } },
  ],
}

describe('createArcLengthIndex (2D)', () => {
  it('totalLength が各セグメントの合計に等しい', () => {
    const { lengths, totalLength } = createArcLengthIndex(linePath)
    expect(totalLength).toBeCloseTo(
      lengths.reduce((s, l) => s + l, 0),
      6,
    )
  })

  it('cumulativeLengths の末尾が totalLength に等しい', () => {
    const { cumulativeLengths, totalLength } = createArcLengthIndex(linePath)
    expect(cumulativeLengths[cumulativeLengths.length - 1]).toBeCloseTo(totalLength, 6)
  })

  it('locate(0) は先頭セグメントの先頭を返す', () => {
    const { locate } = createArcLengthIndex(linePath)
    const loc = locate(0)
    expect(loc.segmentIndex).toBe(0)
    expect(loc.localRatio).toBeCloseTo(0, 6)
  })

  it('locate(1) は最終セグメントの末尾を返す', () => {
    const { locate } = createArcLengthIndex(linePath)
    const loc = locate(1)
    expect(loc.segmentIndex).toBe(linePath.segments.length - 1)
    expect(loc.localRatio).toBeCloseTo(1, 6)
  })

  it('locate は範囲外 ratio を clamp する', () => {
    const { locate } = createArcLengthIndex(linePath)
    const below = locate(-0.5)
    const above = locate(1.5)
    expect(below.segmentIndex).toBe(0)
    expect(below.localRatio).toBeCloseTo(0, 6)
    expect(above.segmentIndex).toBe(linePath.segments.length - 1)
    expect(above.localRatio).toBeCloseTo(1, 6)
  })

  it('locate(0.5) は等長セグメントの境界付近を返す', () => {
    const { locate } = createArcLengthIndex(linePath)
    const loc = locate(0.5)
    expect(loc.segmentIndex).toBeGreaterThanOrEqual(0)
    expect(loc.segmentIndex).toBeLessThanOrEqual(1)
  })

  it('ゼロ長セグメント(退化)を含んでも crash しない', () => {
    const degenerate: BezierPath<Point2D> = {
      start: { x: 0, y: 0 },
      segments: [
        { cp1: { x: 0, y: 0 }, cp2: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
        { cp1: { x: 33, y: 0 }, cp2: { x: 67, y: 0 }, end: { x: 100, y: 0 } },
      ],
    }
    const idx = createArcLengthIndex(degenerate)
    expect(idx.totalLength).toBeGreaterThan(0)
    const loc = idx.locate(0.5)
    expect(Number.isFinite(loc.localRatio)).toBe(true)
  })

  it('options.samples を受け取り、結果が有限値になる', () => {
    const low = createArcLengthIndex(linePath, { samples: 4 })
    const high = createArcLengthIndex(linePath, { samples: 256 })
    expect(Number.isFinite(low.totalLength)).toBe(true)
    expect(Number.isFinite(high.totalLength)).toBe(true)
    expect(Math.abs(high.totalLength - low.totalLength)).toBeLessThan(1)
  })
})

describe('createArcLengthIndex (3D)', () => {
  const path3d: BezierPath<Point3D> = {
    start: { x: 0, y: 0, z: 0 },
    segments: [
      // (0,0,0) → (3,4,12) は距離 13 の直線(3-4-12 ピタゴラス)
      { cp1: { x: 1, y: 4 / 3, z: 4 }, cp2: { x: 2, y: 8 / 3, z: 8 }, end: { x: 3, y: 4, z: 12 } },
    ],
  }

  it('3D 直線セグメントで totalLength が期待値に近い', () => {
    const { totalLength } = createArcLengthIndex(path3d)
    expect(totalLength).toBeCloseTo(13, 0)
  })

  it('startPoints は 3D のまま(z を含む)', () => {
    const { startPoints } = createArcLengthIndex(path3d)
    expect(startPoints[0]).toEqual({ x: 0, y: 0, z: 0 })
  })
})
