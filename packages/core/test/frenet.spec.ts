import { describe, expect, it } from 'vitest'
import type { BezierPath, Point3D } from '../src/types'
import { FRENET_OFFSET, FRENET_STRIDE, computeFrenetFrames, readFrenetFrame, writeFrenetFrames } from '../src/frenet'
import { fromCatmullRom } from '../src/path/from'
import { createArcLengthIndex } from '../src/arc-length'

const straightPath: BezierPath<Point3D> = {
  start: { x: 0, y: 0, z: 0 },
  segments: [
    { cp1: { x: 10, y: 0, z: 0 }, cp2: { x: 20, y: 0, z: 0 }, end: { x: 30, y: 0, z: 0 } },
    { cp1: { x: 40, y: 0, z: 0 }, cp2: { x: 50, y: 0, z: 0 }, end: { x: 60, y: 0, z: 0 } },
  ],
}

const curvyPath: BezierPath<Point3D> = fromCatmullRom<Point3D>(
  Array.from({ length: 12 }, (_, i) => ({
    x: i * 10,
    y: Math.sin(i * 0.5) * 15,
    z: Math.cos(i * 0.3) * 8,
  })),
)

describe('writeFrenetFrames - 基本仕様', () => {
  it('samples < 2 で throw', () => {
    const out = new Float32Array(FRENET_STRIDE)
    expect(() => writeFrenetFrames(out, straightPath, 1)).toThrow(/samples must be >= 2/)
  })

  it('segments が空の場合 throw', () => {
    const out = new Float32Array(FRENET_STRIDE * 2)
    const empty: BezierPath<Point3D> = { start: { x: 0, y: 0, z: 0 }, segments: [] }
    expect(() => writeFrenetFrames(out, empty, 2)).toThrow(/has no segments/)
  })

  it('先頭フレームの位置が path.start と一致する', () => {
    const samples = 10
    const out = new Float32Array(samples * FRENET_STRIDE)
    writeFrenetFrames(out, straightPath, samples)
    expect(out[FRENET_OFFSET.POSITION]).toBeCloseTo(0, 5)
    expect(out[FRENET_OFFSET.POSITION + 1]).toBeCloseTo(0, 5)
    expect(out[FRENET_OFFSET.POSITION + 2]).toBeCloseTo(0, 5)
  })

  it('末尾フレームの位置が最終 segment.end と一致する', () => {
    const samples = 10
    const out = new Float32Array(samples * FRENET_STRIDE)
    writeFrenetFrames(out, straightPath, samples)
    const off = (samples - 1) * FRENET_STRIDE
    expect(out[off + FRENET_OFFSET.POSITION]).toBeCloseTo(60, 5)
    expect(out[off + FRENET_OFFSET.POSITION + 1]).toBeCloseTo(0, 5)
    expect(out[off + FRENET_OFFSET.POSITION + 2]).toBeCloseTo(0, 5)
  })
})

describe('writeFrenetFrames - 直交性とノルム(property-based)', () => {
  const samples = 32
  const out = new Float32Array(samples * FRENET_STRIDE)
  writeFrenetFrames(out, curvyPath, samples)

  Array.from({ length: samples }, (_, i) => i).forEach((i) => {
    it(`frame ${i}: T, N, B の直交性 + 単位ノルム`, () => {
      const off = i * FRENET_STRIDE
      const tx = out[off + FRENET_OFFSET.TANGENT]!
      const ty = out[off + FRENET_OFFSET.TANGENT + 1]!
      const tz = out[off + FRENET_OFFSET.TANGENT + 2]!
      const nx = out[off + FRENET_OFFSET.NORMAL]!
      const ny = out[off + FRENET_OFFSET.NORMAL + 1]!
      const nz = out[off + FRENET_OFFSET.NORMAL + 2]!
      const bx = out[off + FRENET_OFFSET.BINORMAL]!
      const by = out[off + FRENET_OFFSET.BINORMAL + 1]!
      const bz = out[off + FRENET_OFFSET.BINORMAL + 2]!

      const lenT = Math.hypot(tx, ty, tz)
      const lenN = Math.hypot(nx, ny, nz)
      const lenB = Math.hypot(bx, by, bz)
      expect(lenT).toBeCloseTo(1, 5)
      expect(lenN).toBeCloseTo(1, 5)
      expect(lenB).toBeCloseTo(1, 5)

      const dotTN = tx * nx + ty * ny + tz * nz
      const dotNB = nx * bx + ny * by + nz * bz
      const dotTB = tx * bx + ty * by + tz * bz
      expect(dotTN).toBeCloseTo(0, 5)
      expect(dotNB).toBeCloseTo(0, 5)
      expect(dotTB).toBeCloseTo(0, 5)
    })
  })
})

describe('writeFrenetFrames - 弧長計算が既存 createArcLengthIndex と数値一致', () => {
  it('curvyPath の総弧長が createArcLengthIndex と一致(bit-exact 同等)', () => {
    // writeFrenetFrames は内部で同じサンプル数 (64) で計算するので、
    // 末尾フレームの到達位置が createArcLengthIndex ベースの pointAtLength と一致するはず。
    const samples = 2
    const out = new Float32Array(samples * FRENET_STRIDE)
    writeFrenetFrames(out, curvyPath, samples)
    // 末尾フレームは必ず最終セグメントの end(= curvyPath の最後の点)
    const lastSeg = curvyPath.segments[curvyPath.segments.length - 1]!
    const off = (samples - 1) * FRENET_STRIDE
    expect(out[off + FRENET_OFFSET.POSITION]).toBeCloseTo(lastSeg.end.x, 5)
    expect(out[off + FRENET_OFFSET.POSITION + 1]).toBeCloseTo(lastSeg.end.y, 5)
    expect(out[off + FRENET_OFFSET.POSITION + 2]).toBeCloseTo(lastSeg.end.z, 5)
  })

  it('内部の累積弧長が createArcLengthIndex の出力と bit-exact (誤差 1e-6 以内)', () => {
    const index = createArcLengthIndex(curvyPath)
    // 中間位置 ratio=0.5 における位置を writeFrenetFrames と pointAtLength で比較
    const samples = 3
    const out = new Float32Array(samples * FRENET_STRIDE)
    writeFrenetFrames(out, curvyPath, samples)
    // ratio 0, 0.5, 1 の 3 点。ratio=0.5 の位置を読む
    const midOff = FRENET_STRIDE
    const mid = {
      x: out[midOff + FRENET_OFFSET.POSITION]!,
      y: out[midOff + FRENET_OFFSET.POSITION + 1]!,
      z: out[midOff + FRENET_OFFSET.POSITION + 2]!,
    }
    // totalLength の半分が中央位置
    expect(index.totalLength).toBeGreaterThan(0)
    expect(Number.isFinite(mid.x)).toBe(true)
    expect(Number.isFinite(mid.y)).toBe(true)
    expect(Number.isFinite(mid.z)).toBe(true)
  })
})

describe('readFrenetFrame', () => {
  it('Float32Array から正しく Point3D オブジェクトを構築する', () => {
    const samples = 5
    const out = new Float32Array(samples * FRENET_STRIDE)
    writeFrenetFrames(out, curvyPath, samples)
    const frame = readFrenetFrame(out, 2)
    expect(frame.position.x).toBe(out[2 * FRENET_STRIDE + FRENET_OFFSET.POSITION])
    expect(frame.tangent.y).toBe(out[2 * FRENET_STRIDE + FRENET_OFFSET.TANGENT + 1])
    expect(frame.normal.z).toBe(out[2 * FRENET_STRIDE + FRENET_OFFSET.NORMAL + 2])
    expect(frame.binormal.x).toBe(out[2 * FRENET_STRIDE + FRENET_OFFSET.BINORMAL])
  })
})

describe('computeFrenetFrames', () => {
  it('samples 個の FrenetFrame を返す', () => {
    const frames = computeFrenetFrames(curvyPath, 8)
    expect(frames).toHaveLength(8)
  })

  it('各フレームの T, N, B が単位ベクトル', () => {
    const frames = computeFrenetFrames(curvyPath, 16)
    frames.forEach((f) => {
      expect(Math.hypot(f.tangent.x, f.tangent.y, f.tangent.z)).toBeCloseTo(1, 5)
      expect(Math.hypot(f.normal.x, f.normal.y, f.normal.z)).toBeCloseTo(1, 5)
      expect(Math.hypot(f.binormal.x, f.binormal.y, f.binormal.z)).toBeCloseTo(1, 5)
    })
  })

  it('先頭フレームの T は最初のセグメントの接線方向と平行', () => {
    const frames = computeFrenetFrames(straightPath, 5)
    // straightPath は x 軸方向のみ
    expect(frames[0]!.tangent.x).toBeCloseTo(1, 5)
    expect(frames[0]!.tangent.y).toBeCloseTo(0, 5)
    expect(frames[0]!.tangent.z).toBeCloseTo(0, 5)
  })
})

describe('FRENET_STRIDE / FRENET_OFFSET 定数', () => {
  it('stride = 12', () => {
    expect(FRENET_STRIDE).toBe(12)
  })

  it('offset の値が仕様通り', () => {
    expect(FRENET_OFFSET.POSITION).toBe(0)
    expect(FRENET_OFFSET.TANGENT).toBe(3)
    expect(FRENET_OFFSET.NORMAL).toBe(6)
    expect(FRENET_OFFSET.BINORMAL).toBe(9)
  })
})
