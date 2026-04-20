import { describe, expect, it } from 'vitest'
import type { BezierPath, Point2D, Point3D } from '../../src/types'
import { createPathSplitter } from '../../src/path/split'
import { segmentLength } from '../../src/segment'
import { expectPointClose } from '../helpers'

// S 字カーブ(2 セグメント)
const path: BezierPath<Point2D> = {
  start: { x: 0, y: 0 },
  segments: [
    { cp1: { x: 0, y: 100 }, cp2: { x: 100, y: 100 }, end: { x: 100, y: 0 } },
    { cp1: { x: 100, y: -100 }, cp2: { x: 200, y: -100 }, end: { x: 200, y: 0 } },
  ],
}

const totalArcLength2D = (p: BezierPath<Point2D>): number =>
  p.segments.reduce<{ readonly sum: number; readonly prev: Point2D }>(
    (acc, seg) => ({ sum: acc.sum + segmentLength(acc.prev, seg), prev: seg.end }),
    { sum: 0, prev: p.start },
  ).sum

describe('createPathSplitter (2D)', () => {
  it('ratio=0 では左が縮退、右の終点は元パスの終点と一致', () => {
    const split = createPathSplitter(path)
    const [left, right] = split(0)
    expectPointClose(left.start, path.start)
    expectPointClose(right.segments[right.segments.length - 1]!.end, path.segments[path.segments.length - 1]!.end)
  })

  it('ratio=1 では右が縮退、左の終点は元パスの終点と一致', () => {
    const split = createPathSplitter(path)
    const [left, right] = split(1)
    expectPointClose(left.start, path.start)
    expectPointClose(left.segments[left.segments.length - 1]!.end, path.segments[path.segments.length - 1]!.end)
    expect(right.segments.length).toBeGreaterThanOrEqual(1)
  })

  it('ratio は範囲外でも clamp(0,1) される', () => {
    const split = createPathSplitter(path)
    const [leftNeg] = split(-2)
    const [leftHi] = split(2)
    expectPointClose(leftNeg.start, path.start)
    expectPointClose(leftHi.segments[leftHi.segments.length - 1]!.end, path.segments[path.segments.length - 1]!.end)
  })

  it('左の終点と右の始点が一致する', () => {
    const split = createPathSplitter(path)
    const [left, right] = split(0.5)
    const leftEnd = left.segments[left.segments.length - 1]!.end
    expectPointClose(leftEnd, right.start)
  })

  it('左右のセグメント数の合計が元のセグメント数 + 1', () => {
    const split = createPathSplitter(path)
    const [left, right] = split(0.3)
    expect(left.segments.length + right.segments.length).toBe(path.segments.length + 1)
  })

  it('分割後の左右の弧長の合計が元の弧長に近い', () => {
    const split = createPathSplitter(path)
    const [left, right] = split(0.4)
    const originalLength = totalArcLength2D(path)
    expect(totalArcLength2D(left) + totalArcLength2D(right)).toBeCloseTo(originalLength, 0)
  })

  it('ratio=0.5 で左右の弧長がほぼ等しい', () => {
    const split = createPathSplitter(path)
    const [left, right] = split(0.5)
    expect(totalArcLength2D(left) / totalArcLength2D(right)).toBeCloseTo(1, 0)
  })
})

describe('createPathSplitter (3D)', () => {
  const path3d: BezierPath<Point3D> = {
    start: { x: 0, y: 0, z: 0 },
    segments: [{ cp1: { x: 1, y: 4 / 3, z: 4 }, cp2: { x: 2, y: 8 / 3, z: 8 }, end: { x: 3, y: 4, z: 12 } }],
  }

  it('分割点の前半終点と後半始点が 3D で一致', () => {
    const split = createPathSplitter(path3d)
    const [left, right] = split(0.5)
    const leftEnd = left.segments[left.segments.length - 1]!.end
    expect(leftEnd.x).toBeCloseTo(right.start.x, 4)
    expect(leftEnd.y).toBeCloseTo(right.start.y, 4)
    expect(leftEnd.z).toBeCloseTo(right.start.z, 4)
  })

  it('後半の最終 end は 3D で元の終点と一致', () => {
    const split = createPathSplitter(path3d)
    const [, right] = split(0.3)
    const last = right.segments[right.segments.length - 1]!.end
    expect(last).toEqual({ x: 3, y: 4, z: 12 })
  })
})
