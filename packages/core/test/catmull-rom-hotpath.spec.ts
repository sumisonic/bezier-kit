import { describe, expect, it } from 'vitest'
import type { Point3D } from '../src/types'
import {
  CATMULL_ROM_SEGMENT_OFFSET,
  CATMULL_ROM_SEGMENT_STRIDE,
  catmullRomSegmentCount,
  writeCatmullRomSegments,
  writeFrenetFramesFromCatmullRom,
  writeFrenetFramesFromSegments,
} from '../src/catmull-rom-hotpath'
import { fromCatmullRom } from '../src/path/from'
import { FRENET_STRIDE, writeFrenetFrames } from '../src/frenet'

const flattenPoints = (pts: readonly Point3D[]): Float32Array => {
  const out = new Float32Array(pts.length * 3)
  pts.forEach((p, i) => {
    out[i * 3] = p.x
    out[i * 3 + 1] = p.y
    out[i * 3 + 2] = p.z
  })
  return out
}

/**
 * `number` (double) を `Float32Array` に書き込み → 読み直すことで、
 * float32 精度に切り詰めた値を得る。Float32Array と double の比較で使う。
 */
const toFloat32 = (v: number): number => {
  const buf = new Float32Array(1)
  buf[0] = v
  return buf[0]
}

const points: readonly Point3D[] = Array.from({ length: 12 }, (_, i) => ({
  x: i * 10,
  y: Math.sin(i * 0.5) * 15,
  z: Math.cos(i * 0.3) * 8,
}))

describe('CATMULL_ROM_SEGMENT_STRIDE / OFFSET', () => {
  it('stride = 12', () => {
    expect(CATMULL_ROM_SEGMENT_STRIDE).toBe(12)
  })

  it('offset の値が仕様通り', () => {
    expect(CATMULL_ROM_SEGMENT_OFFSET.START).toBe(0)
    expect(CATMULL_ROM_SEGMENT_OFFSET.CP1).toBe(3)
    expect(CATMULL_ROM_SEGMENT_OFFSET.CP2).toBe(6)
    expect(CATMULL_ROM_SEGMENT_OFFSET.END).toBe(9)
  })
})

describe('catmullRomSegmentCount', () => {
  it('pointCount が 2 で 1 segment', () => {
    expect(catmullRomSegmentCount(2)).toBe(1)
  })

  it('pointCount = 12 → 11 segments', () => {
    expect(catmullRomSegmentCount(12)).toBe(11)
  })

  it('pointCount < 2 で throw', () => {
    expect(() => catmullRomSegmentCount(1)).toThrow(/>= 2/)
    expect(() => catmullRomSegmentCount(0)).toThrow(/>= 2/)
  })
})

describe('writeCatmullRomSegments - fromCatmullRom と数値一致(float32 近似)', () => {
  it('各セグメントの start, cp1, cp2, end が fromCatmullRom と 1e-4 以内で一致', () => {
    // 両者とも最終的に float32 値を出すが、中間計算の精度が異なる:
    // - writeCatmullRomSegments: Float32Array から読んだ float32 精度の入力 → double で計算 → float32 に格納
    // - fromCatmullRom: double 精度の入力 → double で計算 → (後で toFloat32)
    // 入力の精度差が結果に最大 1 ULP (~1e-6 の相対誤差) の差を生む。
    const cps = flattenPoints(points)
    const segCount = points.length - 1
    const out = new Float32Array(segCount * CATMULL_ROM_SEGMENT_STRIDE)
    writeCatmullRomSegments(out, cps, points.length)

    const expected = fromCatmullRom<Point3D>(points)
    // start は制御点をそのまま書くだけなので bit-exact
    expect(out[CATMULL_ROM_SEGMENT_OFFSET.START]).toBe(toFloat32(expected.start.x))
    expect(out[CATMULL_ROM_SEGMENT_OFFSET.START + 1]).toBe(toFloat32(expected.start.y))
    expect(out[CATMULL_ROM_SEGMENT_OFFSET.START + 2]).toBe(toFloat32(expected.start.z))

    expected.segments.forEach((seg, i) => {
      const off = i * CATMULL_ROM_SEGMENT_STRIDE
      expect(Math.abs((out[off + CATMULL_ROM_SEGMENT_OFFSET.CP1] ?? 0) - seg.cp1.x)).toBeLessThan(1e-4)
      expect(Math.abs((out[off + CATMULL_ROM_SEGMENT_OFFSET.CP1 + 1] ?? 0) - seg.cp1.y)).toBeLessThan(1e-4)
      expect(Math.abs((out[off + CATMULL_ROM_SEGMENT_OFFSET.CP1 + 2] ?? 0) - seg.cp1.z)).toBeLessThan(1e-4)

      expect(Math.abs((out[off + CATMULL_ROM_SEGMENT_OFFSET.CP2] ?? 0) - seg.cp2.x)).toBeLessThan(1e-4)
      expect(Math.abs((out[off + CATMULL_ROM_SEGMENT_OFFSET.CP2 + 1] ?? 0) - seg.cp2.y)).toBeLessThan(1e-4)
      expect(Math.abs((out[off + CATMULL_ROM_SEGMENT_OFFSET.CP2 + 2] ?? 0) - seg.cp2.z)).toBeLessThan(1e-4)

      // END は制御点をそのまま書くだけなので bit-exact(float32 精度で)
      expect(out[off + CATMULL_ROM_SEGMENT_OFFSET.END]).toBe(toFloat32(seg.end.x))
      expect(out[off + CATMULL_ROM_SEGMENT_OFFSET.END + 1]).toBe(toFloat32(seg.end.y))
      expect(out[off + CATMULL_ROM_SEGMENT_OFFSET.END + 2]).toBe(toFloat32(seg.end.z))
    })
  })

  it('START が各セグメントで前 segment の END と一致', () => {
    const cps = flattenPoints(points)
    const segCount = points.length - 1
    const out = new Float32Array(segCount * CATMULL_ROM_SEGMENT_STRIDE)
    writeCatmullRomSegments(out, cps, points.length)

    Array.from({ length: segCount - 1 }, (_, i) => i).forEach((i) => {
      const curOff = i * CATMULL_ROM_SEGMENT_STRIDE
      const nextOff = (i + 1) * CATMULL_ROM_SEGMENT_STRIDE
      expect(out[curOff + CATMULL_ROM_SEGMENT_OFFSET.END]).toBe(out[nextOff + CATMULL_ROM_SEGMENT_OFFSET.START])
      expect(out[curOff + CATMULL_ROM_SEGMENT_OFFSET.END + 1]).toBe(out[nextOff + CATMULL_ROM_SEGMENT_OFFSET.START + 1])
      expect(out[curOff + CATMULL_ROM_SEGMENT_OFFSET.END + 2]).toBe(out[nextOff + CATMULL_ROM_SEGMENT_OFFSET.START + 2])
    })
  })

  it('tension を変えても fromCatmullRom と 1e-4 以内で一致', () => {
    const cps = flattenPoints(points)
    const segCount = points.length - 1
    const out = new Float32Array(segCount * CATMULL_ROM_SEGMENT_STRIDE)
    writeCatmullRomSegments(out, cps, points.length, { tension: 0.5 })

    const expected = fromCatmullRom<Point3D>(points, { tension: 0.5 })
    expected.segments.forEach((seg, i) => {
      const off = i * CATMULL_ROM_SEGMENT_STRIDE
      expect(Math.abs((out[off + CATMULL_ROM_SEGMENT_OFFSET.CP1] ?? 0) - seg.cp1.x)).toBeLessThan(1e-4)
      expect(Math.abs((out[off + CATMULL_ROM_SEGMENT_OFFSET.CP2] ?? 0) - seg.cp2.x)).toBeLessThan(1e-4)
    })
  })

  it('pointCount < 2 で throw', () => {
    const cps = new Float32Array([0, 0, 0])
    const out = new Float32Array(CATMULL_ROM_SEGMENT_STRIDE)
    expect(() => writeCatmullRomSegments(out, cps, 1)).toThrow(/>= 2/)
  })
})

describe('writeFrenetFramesFromSegments と writeFrenetFrames(BezierPath 版)が近似一致', () => {
  it('同じ入力から近似同一の Frenet 出力を得る(float32 ↔ double の丸め差を考慮)', () => {
    // 両者の入力制御点は同じ論理値だが、Float32Array 経由は float32 精度、
    // BezierPath 経由は double 精度で計算される。結果として float32 の丸め差が
    // 数 ULP 分の違いを生むため、完全一致ではなく近似一致で検証する。
    const cps = flattenPoints(points)
    const segCount = points.length - 1
    const segments = new Float32Array(segCount * CATMULL_ROM_SEGMENT_STRIDE)
    writeCatmullRomSegments(segments, cps, points.length)

    const samples = 21
    const out1 = new Float32Array(samples * FRENET_STRIDE)
    writeFrenetFramesFromSegments(out1, segments, segCount, samples)

    const out2 = new Float32Array(samples * FRENET_STRIDE)
    writeFrenetFrames(out2, fromCatmullRom<Point3D>(points), samples)

    // float32 の ULP 差は ~1e-5 オーダー。テストはそれに合わせる。
    Array.from(out1).forEach((v, i) => {
      expect(Math.abs((out2[i] ?? 0) - v)).toBeLessThan(1e-4)
    })
  })
})

describe('writeFrenetFramesFromCatmullRom(一体化 API)', () => {
  it('2 段 API と同じ出力', () => {
    const cps = flattenPoints(points)
    const segCount = points.length - 1
    const samples = 21

    // ステップ別
    const segments = new Float32Array(segCount * CATMULL_ROM_SEGMENT_STRIDE)
    writeCatmullRomSegments(segments, cps, points.length)
    const outStepped = new Float32Array(samples * FRENET_STRIDE)
    writeFrenetFramesFromSegments(outStepped, segments, segCount, samples)

    // 一体化
    const outOneShot = new Float32Array(samples * FRENET_STRIDE)
    writeFrenetFramesFromCatmullRom(outOneShot, cps, points.length, samples)

    Array.from(outOneShot).forEach((v, i) => {
      expect(outStepped[i]).toBe(v)
    })
  })

  it('arcLengthSamples オプションが反映される', () => {
    const cps = flattenPoints(points)
    const samples = 5
    const out = new Float32Array(samples * FRENET_STRIDE)
    // 32 と 64 で精度が違うはずだが、どちらも crash せず数値が出る
    writeFrenetFramesFromCatmullRom(out, cps, points.length, samples, { arcLengthSamples: 32 })
    expect(Number.isFinite(out[0])).toBe(true)
  })
})
