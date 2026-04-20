import { describe, expect, it } from 'vitest'
import type { BezierPath, BezierSegment, Point2D, Point3D } from '../src/types'
import { arcLengthTo, pointAt, segmentLength, segmentStartPoints, splitSegmentAt, tangentAt } from '../src/segment'
import { expectPointClose } from './helpers'

const start: Point2D = { x: 0, y: 0 }
const seg: BezierSegment<Point2D> = { cp1: { x: 0, y: 100 }, cp2: { x: 100, y: 100 }, end: { x: 100, y: 0 } }

describe('pointAt (2D)', () => {
  it('t=0 で始点を返す', () => {
    expectPointClose(pointAt(start, seg, 0), start)
  })

  it('t=1 で終点を返す', () => {
    expectPointClose(pointAt(start, seg, 1), seg.end)
  })

  it('t=0.5 で中間付近の座標を返す', () => {
    const mid = pointAt(start, seg, 0.5)
    expect(mid.x).toBeGreaterThan(0)
    expect(mid.x).toBeLessThan(100)
    expect(mid.y).toBeGreaterThan(0)
  })

  it('t < 0 / t > 1 でも外挿される', () => {
    const before = pointAt(start, seg, -0.5)
    const after = pointAt(start, seg, 1.5)
    expect(Number.isFinite(before.x)).toBe(true)
    expect(Number.isFinite(after.x)).toBe(true)
  })
})

describe('pointAt (3D)', () => {
  const start3d: Point3D = { x: 0, y: 0, z: 0 }
  const seg3d: BezierSegment<Point3D> = {
    cp1: { x: 0, y: 100, z: 50 },
    cp2: { x: 100, y: 100, z: 50 },
    end: { x: 100, y: 0, z: 100 },
  }

  it('t=0 で始点を返し z も含む', () => {
    const p = pointAt(start3d, seg3d, 0)
    expect(p).toEqual(start3d)
    expect('z' in p).toBe(true)
  })

  it('t=1 で終点を返す(z=100)', () => {
    const p = pointAt(start3d, seg3d, 1)
    expect(p.z).toBe(100)
  })

  it('t=0.5 で z が中間値域', () => {
    const p = pointAt(start3d, seg3d, 0.5)
    expect(p.z).toBeGreaterThan(0)
    expect(p.z).toBeLessThan(100)
  })
})

describe('tangentAt (2D)', () => {
  it('t=0 の接線は 3 * (cp1 - start)', () => {
    const v = tangentAt(start, seg, 0)
    expectPointClose(v, { x: 3 * (seg.cp1.x - start.x), y: 3 * (seg.cp1.y - start.y) })
  })

  it('t=1 の接線は 3 * (end - cp2)', () => {
    const v = tangentAt(start, seg, 1)
    expectPointClose(v, { x: 3 * (seg.end.x - seg.cp2.x), y: 3 * (seg.end.y - seg.cp2.y) })
  })

  it('対称な山型の曲線では t=0.5 の接線は水平(x 方向)', () => {
    const tan = tangentAt(start, seg, 0.5)
    expect(Math.abs(tan.y)).toBeLessThan(1e-9)
    expect(tan.x).toBeGreaterThan(0)
  })

  it('数値微分とほぼ一致する(差分法)', () => {
    const t = 0.3
    const h = 1e-5
    const p0 = pointAt(start, seg, t - h)
    const p1 = pointAt(start, seg, t + h)
    const numeric = { x: (p1.x - p0.x) / (2 * h), y: (p1.y - p0.y) / (2 * h) }
    const analytic = tangentAt(start, seg, t)
    expectPointClose(analytic, numeric, 3)
  })
})

describe('tangentAt (3D)', () => {
  const start3d: Point3D = { x: 0, y: 0, z: 0 }
  const seg3d: BezierSegment<Point3D> = {
    cp1: { x: 10, y: 0, z: 0 },
    cp2: { x: 20, y: 0, z: 0 },
    end: { x: 30, y: 0, z: 0 },
  }

  it('t=0 の接線は 3 * (cp1 - start)、z 成分も 3D', () => {
    const v = tangentAt(start3d, seg3d, 0)
    expect(v.x).toBeCloseTo(30, 6)
    expect(v.y).toBeCloseTo(0, 6)
    expect(v.z).toBeCloseTo(0, 6)
  })

  it('z 軸沿いのセグメントでは接線の z が 0 ではない', () => {
    const zSeg: BezierSegment<Point3D> = {
      cp1: { x: 0, y: 0, z: 10 },
      cp2: { x: 0, y: 0, z: 20 },
      end: { x: 0, y: 0, z: 30 },
    }
    const v = tangentAt(start3d, zSeg, 0.5)
    expect(v.x).toBeCloseTo(0, 6)
    expect(v.y).toBeCloseTo(0, 6)
    expect(v.z).toBeGreaterThan(0)
  })
})

describe('splitSegmentAt (2D)', () => {
  it('分割点が元の曲線上の点と一致する', () => {
    const t = 0.4
    const [left] = splitSegmentAt(start, seg, t)
    expectPointClose(left.end, pointAt(start, seg, t))
  })

  it('前半の終点と後半の始点(= 前半の end)が曲線上の点に一致', () => {
    const [left] = splitSegmentAt(start, seg, 0.5)
    expectPointClose(left.end, pointAt(start, seg, 0.5))
  })

  it('後半の終点が元のセグメントの終点と一致する', () => {
    const [, right] = splitSegmentAt(start, seg, 0.3)
    expectPointClose(right.end, seg.end)
  })

  it('t=0 で左は縮退、右は元のセグメントに近い', () => {
    const [left, right] = splitSegmentAt(start, seg, 0)
    expectPointClose(left.end, start)
    expectPointClose(right.end, seg.end)
  })
})

describe('splitSegmentAt (3D)', () => {
  const start3d: Point3D = { x: 0, y: 0, z: 0 }
  const seg3d: BezierSegment<Point3D> = {
    cp1: { x: 10, y: 100, z: 50 },
    cp2: { x: 90, y: 100, z: 50 },
    end: { x: 100, y: 0, z: 100 },
  }

  it('分割点が pointAt と一致(z 含む)', () => {
    const [left] = splitSegmentAt(start3d, seg3d, 0.4)
    const p = pointAt(start3d, seg3d, 0.4)
    expect(left.end.x).toBeCloseTo(p.x, 6)
    expect(left.end.y).toBeCloseTo(p.y, 6)
    expect(left.end.z).toBeCloseTo(p.z, 6)
  })

  it('後半の終点が元のセグメントの終点と一致する(z 含む)', () => {
    const [, right] = splitSegmentAt(start3d, seg3d, 0.3)
    expect(right.end).toEqual(seg3d.end)
  })
})

describe('arcLengthTo / segmentLength', () => {
  const lineStart: Point2D = { x: 0, y: 0 }
  const lineSeg: BezierSegment<Point2D> = {
    cp1: { x: 33.33, y: 0 },
    cp2: { x: 66.67, y: 0 },
    end: { x: 100, y: 0 },
  }

  it('直線セグメントの全長は始点-終点間の距離に近い', () => {
    const len = segmentLength(lineStart, lineSeg)
    expect(len).toBeCloseTo(100, 0)
  })

  it('tEnd=0 の弧長は 0', () => {
    expect(arcLengthTo(lineStart, lineSeg, 0)).toBe(0)
  })

  it('tEnd=0.5 の弧長は全長の約半分', () => {
    const half = arcLengthTo(lineStart, lineSeg, 0.5)
    const full = segmentLength(lineStart, lineSeg)
    expect(half).toBeCloseTo(full / 2, 0)
  })

  it('samples を増やすと精度が上がる(直線では同じだが発散しない)', () => {
    const lowSamples = segmentLength(lineStart, lineSeg, { samples: 4 })
    const highSamples = segmentLength(lineStart, lineSeg, { samples: 256 })
    expect(Math.abs(highSamples - lowSamples)).toBeLessThan(1)
  })

  it('退化セグメント(全ての点が同じ)の長さは 0', () => {
    const degenerate: BezierSegment<Point2D> = { cp1: start, cp2: start, end: start }
    expect(segmentLength(start, degenerate)).toBeCloseTo(0, 10)
  })

  it('3D 直線セグメントの長さは 3D 距離に近い', () => {
    const s: Point3D = { x: 0, y: 0, z: 0 }
    const lineSeg3d: BezierSegment<Point3D> = {
      cp1: { x: 1, y: 2, z: 2 },
      cp2: { x: 2, y: 4, z: 4 },
      end: { x: 3, y: 6, z: 6 },
    }
    // (0,0,0) → (3,6,6) の距離 = 9
    const len = segmentLength(s, lineSeg3d)
    expect(len).toBeCloseTo(9, 0)
  })
})

describe('segmentStartPoints', () => {
  it('各セグメントの始点を正しく返す', () => {
    const path: BezierPath<Point2D> = {
      start: { x: 0, y: 0 },
      segments: [
        { cp1: { x: 1, y: 1 }, cp2: { x: 2, y: 2 }, end: { x: 10, y: 0 } },
        { cp1: { x: 11, y: 1 }, cp2: { x: 12, y: 2 }, end: { x: 20, y: 0 } },
        { cp1: { x: 21, y: 1 }, cp2: { x: 22, y: 2 }, end: { x: 30, y: 0 } },
      ],
    }
    const points = segmentStartPoints(path)
    expect(points).toHaveLength(3)
    expectPointClose(points[0]!, { x: 0, y: 0 })
    expectPointClose(points[1]!, { x: 10, y: 0 })
    expectPointClose(points[2]!, { x: 20, y: 0 })
  })

  it('セグメントなしのパスでは [start] のみ(空を返さないよう)', () => {
    const path: BezierPath<Point2D> = { start: { x: 7, y: 3 }, segments: [] }
    const points = segmentStartPoints(path)
    expect(points).toEqual([{ x: 7, y: 3 }])
  })

  it('3D パスの startPoints は z を持つ', () => {
    const path: BezierPath<Point3D> = {
      start: { x: 0, y: 0, z: 0 },
      segments: [
        { cp1: { x: 0, y: 0, z: 0 }, cp2: { x: 0, y: 0, z: 5 }, end: { x: 10, y: 0, z: 10 } },
        { cp1: { x: 10, y: 5, z: 10 }, cp2: { x: 20, y: 5, z: 15 }, end: { x: 30, y: 0, z: 20 } },
      ],
    }
    const points = segmentStartPoints(path)
    expect(points).toHaveLength(2)
    expect(points[0]!.z).toBe(0)
    expect(points[1]!.z).toBe(10)
  })
})
