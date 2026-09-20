import { describe, expect, it } from 'vitest'
import type { BezierPath, Point3D } from '../src/types'
import {
  RMF_OFFSET,
  RMF_STRIDE,
  computeRotationMinimizingFrames,
  createRotationMinimizingFrameWriter,
  readRotationMinimizingFrame,
} from '../src/rmf'
import { FRENET_OFFSET, FRENET_STRIDE, writeFrenetFrames } from '../src/frenet'
import { writeCatmullRomSegments } from '../src/catmull-rom-hotpath'
import { fromCatmullRom } from '../src/path/from'
import { pointAtLength } from '../src/path-query'

type V = readonly [number, number, number]
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V): number => Math.hypot(a[0], a[1], a[2])
/** 2 つの単位ベクトルの角度。`acos(dot)` は dot ≈ 1 で Float32 の丸めを 1e-4 rad に増幅するので atan2 で測る */
const angle = (a: V, b: V): number => Math.atan2(norm(cross(a, b)), dot(a, b))
const vec = (p: Point3D): V => [p.x, p.y, p.z]

const helixPoints = (count: number, turns: number, pitch: number): readonly Point3D[] =>
  Array.from({ length: count }, (_, i) => {
    const s = (2 * Math.PI * turns * i) / (count - 1)
    return { x: Math.cos(s), y: Math.sin(s), z: pitch * s }
  })

const curvy: BezierPath<Point3D> = fromCatmullRom<Point3D>(
  Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: Math.sin(i * 0.4) * 40, z: Math.cos(i * 0.3) * 20 })),
)
const twistedCubic: BezierPath<Point3D> = {
  start: { x: 0, y: 0, z: 0 },
  segments: [{ cp1: { x: 1, y: 2, z: 0 }, cp2: { x: 2, y: -1, z: 3 }, end: { x: 3, y: 1, z: 1 } }],
}
const helix8: BezierPath<Point3D> = fromCatmullRom<Point3D>(helixPoints(9, 1, 0.3))

const framesOf = (
  path: BezierPath<Point3D>,
  samples: number,
  options: Parameters<typeof createRotationMinimizingFrameWriter>[0] extends infer O
    ? Omit<O, 'maxSegments' | 'samples'>
    : never = {},
  initialNormal?: ArrayLike<number>,
): Float32Array => {
  const out = new Float32Array(samples * RMF_STRIDE)
  createRotationMinimizingFrameWriter({ ...options, maxSegments: path.segments.length, samples }).writePath(
    out,
    path,
    initialNormal,
  )
  return out
}

describe('createRotationMinimizingFrameWriter — 直交基底', () => {
  it.each([
    ['curvy 3D catmull-rom', curvy],
    ['twisted cubic', twistedCubic],
    ['helix 8 segments', helix8],
  ])('%s: 全サンプルで |T|=|N|=|B|=1、互いに直交、B = T × N(Float32 精度)', (_name, path) => {
    const samples = 101
    const out = framesOf(path, samples)
    Array.from({ length: samples }, (_, i) => readRotationMinimizingFrame(out, i)).forEach((f) => {
      const t = vec(f.tangent)
      const n = vec(f.normal)
      const b = vec(f.binormal)
      expect(Math.abs(norm(t) - 1)).toBeLessThan(1e-6)
      expect(Math.abs(norm(n) - 1)).toBeLessThan(1e-6)
      expect(Math.abs(norm(b) - 1)).toBeLessThan(1e-6)
      expect(Math.abs(dot(t, n))).toBeLessThan(1e-6)
      expect(Math.abs(dot(t, b))).toBeLessThan(1e-6)
      expect(Math.abs(dot(n, b))).toBeLessThan(1e-6)
      const c = cross(t, n)
      expect(angle(c, b)).toBeLessThan(1e-6)
    })
  })

  it('RMF_STRIDE / RMF_OFFSET は FRENET_* と同じ値(レイアウト互換)', () => {
    expect(RMF_STRIDE).toBe(FRENET_STRIDE)
    expect(RMF_OFFSET).toEqual(FRENET_OFFSET)
  })
})

describe('createRotationMinimizingFrameWriter — 精度の次数(double reflection)', () => {
  const lastNormal = (path: BezierPath<Point3D>, samples: number, n0: V): V =>
    vec(readRotationMinimizingFrame(framesOf(path, samples, {}, n0), samples - 1).normal)

  it('滑らかな 1 セグメントでは 4 次: サンプルを倍にすると末端法線の誤差が約 1/16(1/8 以上)になる', () => {
    const n0: V = [0, 0, 1]
    const ref = lastNormal(twistedCubic, 16001, n0)
    const e26 = angle(lastNormal(twistedCubic, 26, n0), ref)
    const e51 = angle(lastNormal(twistedCubic, 51, n0), ref)
    // 実測(2026-09-20): 1.41e-5 → 9.43e-7(15 倍)。101 点で Float32 の床(約 1e-7)に達する
    expect(e26).toBeGreaterThan(1e-6)
    expect(e26 / e51).toBeGreaterThan(8)
  })

  it('同じ初期法線なら旧 writeFrenetFrames(接線間の最小回転、2 次)より末端の誤差が小さい', () => {
    // 旧 API は initialNormal を受けないので、旧 API が選んだ初期法線を新 writer に渡して揃える
    const legacy2 = new Float32Array(2 * FRENET_STRIDE)
    writeFrenetFrames(legacy2, helix8, 2)
    const n0: V = [
      legacy2[FRENET_OFFSET.NORMAL]!,
      legacy2[FRENET_OFFSET.NORMAL + 1]!,
      legacy2[FRENET_OFFSET.NORMAL + 2]!,
    ]
    const ref = lastNormal(helix8, 16001, n0)
    const samples = 101
    const legacy = new Float32Array(samples * FRENET_STRIDE)
    writeFrenetFrames(legacy, helix8, samples)
    const legacyLast: V = [
      legacy[(samples - 1) * FRENET_STRIDE + FRENET_OFFSET.NORMAL]!,
      legacy[(samples - 1) * FRENET_STRIDE + FRENET_OFFSET.NORMAL + 1]!,
      legacy[(samples - 1) * FRENET_STRIDE + FRENET_OFFSET.NORMAL + 2]!,
    ]
    const eNew = angle(lastNormal(helix8, samples, n0), ref)
    const eLegacy = angle(legacyLast, ref)
    // 実測(2026-09-20): 新 2.9e-5 / 旧 1.3e-4
    expect(eNew).toBeLessThan(eLegacy / 2)
  })
})

describe('createRotationMinimizingFrameWriter — サンプル配置', () => {
  it("'arc-length'(既定)は曲線に沿って等間隔(隣接間隔の変動係数 < 1e-2)、'segment-t' はそうではない", () => {
    const cv = (out: Float32Array, samples: number): number => {
      const chords = Array.from({ length: samples - 1 }, (_, i) => {
        const a = readRotationMinimizingFrame(out, i).position
        const b = readRotationMinimizingFrame(out, i + 1).position
        return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
      })
      const mean = chords.reduce((s, v) => s + v, 0) / chords.length
      const sd = Math.sqrt(chords.reduce((s, v) => s + (v - mean) ** 2, 0) / chords.length)
      return sd / mean
    }
    // 実測(2026-09-20): arc-length 3.2e-4 / segment-t 6.8e-2
    expect(cv(framesOf(curvy, 101), 101)).toBeLessThan(1e-2)
    expect(cv(framesOf(curvy, 101, { parameterization: 'segment-t' }), 101)).toBeGreaterThan(2e-2)
  })

  it("'arc-length' の位置は pointAtLength(同じ表引き)と一致する(Float32 精度)", () => {
    const samples = 101
    const out = framesOf(curvy, samples)
    Array.from({ length: samples }, (_, i) => i).forEach((i) => {
      const p = pointAtLength(curvy, i / (samples - 1))
      const f = readRotationMinimizingFrame(out, i).position
      expect(Math.hypot(p.x - f.x, p.y - f.y, p.z - f.z)).toBeLessThan(1e-4)
    })
  })

  it("'segment-t' の位置と接線は旧 writeFrenetFrames と一致する(Float32 精度)", () => {
    const samples = 101
    const out = framesOf(curvy, samples, { parameterization: 'segment-t' })
    const legacy = new Float32Array(samples * FRENET_STRIDE)
    writeFrenetFrames(legacy, curvy, samples)
    Array.from({ length: samples * RMF_STRIDE }, (_, i) => i)
      .filter((i) => i % RMF_STRIDE < 6)
      .forEach((i) => {
        expect(Math.abs(out[i]! - legacy[i]!)).toBeLessThan(1e-4)
      })
  })

  it('writeSegments(writeCatmullRomSegments の出力)は writePath と同じフレームを書く', () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({
      x: i * 10,
      y: Math.sin(i * 0.4) * 40,
      z: Math.cos(i * 0.3) * 20,
    }))
    const segments = new Float32Array(19 * 12)
    writeCatmullRomSegments(segments, new Float32Array(pts.flatMap((p) => [p.x, p.y, p.z])), 20)
    const samples = 101
    const w = createRotationMinimizingFrameWriter({ maxSegments: 19, samples })
    const a = new Float32Array(samples * RMF_STRIDE)
    const b = new Float32Array(samples * RMF_STRIDE)
    w.writePath(a, fromCatmullRom<Point3D>(pts))
    w.writeSegments(b, segments, 19)
    Array.from({ length: samples * RMF_STRIDE }, (_, i) => i).forEach((i) => {
      expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(1e-4)
    })
  })

  it('先頭と末尾のサンプルはパスの始点と終点に一致する', () => {
    const samples = 7
    const out = framesOf(curvy, samples)
    const first = readRotationMinimizingFrame(out, 0).position
    const last = readRotationMinimizingFrame(out, samples - 1).position
    const end = curvy.segments[curvy.segments.length - 1]!.end
    expect(first.x).toBeCloseTo(curvy.start.x, 4)
    expect(first.y).toBeCloseTo(curvy.start.y, 4)
    expect(first.z).toBeCloseTo(curvy.start.z, 4)
    expect(last.x).toBeCloseTo(end.x, 4)
    expect(last.y).toBeCloseTo(end.y, 4)
    expect(last.z).toBeCloseTo(end.z, 4)
  })
})

describe('createRotationMinimizingFrameWriter — initialNormal', () => {
  it('与えた法線の、接線に直交する成分が先頭フレームの N になる', () => {
    const given: V = [0.3, 0.9, 0.2]
    const out = framesOf(curvy, 5, {}, given)
    const f = readRotationMinimizingFrame(out, 0)
    const t = vec(f.tangent)
    const d = dot(given, t)
    const expected: V = [given[0] - d * t[0], given[1] - d * t[1], given[2] - d * t[2]]
    expect(angle(vec(f.normal), expected)).toBeLessThan(1e-6)
  })

  it('接線と平行な initialNormal は既定ではフォールバック(有効な直交基底)、strict では throw', () => {
    const f0 = readRotationMinimizingFrame(framesOf(curvy, 5), 0)
    const parallel: V = vec(f0.tangent)
    const out = framesOf(curvy, 5, {}, parallel)
    const f = readRotationMinimizingFrame(out, 0)
    expect(Math.abs(norm(vec(f.normal)) - 1)).toBeLessThan(1e-6)
    expect(Math.abs(dot(vec(f.normal), vec(f.tangent)))).toBeLessThan(1e-6)
    expect(() => framesOf(curvy, 5, { strict: true }, parallel)).toThrow(/initialNormal/)
  })

  it('要素が 3 つ未満なら RangeError', () => {
    expect(() => framesOf(curvy, 5, {}, [0, 1])).toThrow(RangeError)
  })
})

describe('createRotationMinimizingFrameWriter — 退化', () => {
  const zeroPath: BezierPath<Point3D> = {
    start: { x: 1, y: 1, z: 1 },
    segments: [{ cp1: { x: 1, y: 1, z: 1 }, cp2: { x: 1, y: 1, z: 1 }, end: { x: 1, y: 1, z: 1 } }],
  }
  const cuspPath: BezierPath<Point3D> = {
    start: { x: 0, y: 0, z: 0 },
    segments: [{ cp1: { x: 100, y: 100, z: 0 }, cp2: { x: 0, y: 100, z: 0 }, end: { x: 100, y: 0, z: 0 } }],
  }
  const withZeroSegment: BezierPath<Point3D> = {
    start: { x: 0, y: 0, z: 0 },
    segments: [
      { cp1: { x: 10, y: 0, z: 0 }, cp2: { x: 20, y: 0, z: 0 }, end: { x: 30, y: 0, z: 0 } },
      { cp1: { x: 30, y: 0, z: 0 }, cp2: { x: 30, y: 0, z: 0 }, end: { x: 30, y: 0, z: 0 } },
      { cp1: { x: 40, y: 10, z: 0 }, cp2: { x: 50, y: 10, z: 0 }, end: { x: 60, y: 0, z: 0 } },
    ],
  }
  const allFinite = (out: Float32Array): boolean => Array.from(out).every((v) => Number.isFinite(v))
  const allOrthonormal = (out: Float32Array, samples: number): boolean =>
    Array.from({ length: samples }, (_, i) => readRotationMinimizingFrame(out, i)).every((f) => {
      const t = vec(f.tangent)
      const n = vec(f.normal)
      const b = vec(f.binormal)
      return (
        Math.abs(norm(t) - 1) < 1e-6 &&
        Math.abs(norm(n) - 1) < 1e-6 &&
        Math.abs(norm(b) - 1) < 1e-6 &&
        Math.abs(dot(t, n)) < 1e-6 &&
        Math.abs(dot(t, b)) < 1e-6
      )
    })

  it('全長ゼロ: 既定は先頭点 + 固定の直交基底、strict は throw', () => {
    const out = framesOf(zeroPath, 3)
    expect(allFinite(out)).toBe(true)
    expect(allOrthonormal(out, 3)).toBe(true)
    const f = readRotationMinimizingFrame(out, 1)
    expect(f.position).toEqual({ x: 1, y: 1, z: 1 })
    expect(() => framesOf(zeroPath, 3, { strict: true })).toThrow(/zero length/)
  })

  it('cusp(t=0.5 で接線がゼロになる制御点配置)でも既定は NaN を出さず直交基底、strict は throw', () => {
    // 始点 (0,0) から cp1 (100,100)、cp2 (0,100)、end (100,0) の曲線は t=0.5 で B'(t) = 0 になる
    const out = framesOf(cuspPath, 101)
    expect(allFinite(out)).toBe(true)
    expect(allOrthonormal(out, 101)).toBe(true)
    // 'segment-t' で奇数サンプルにすると ratio=0.5 のサンプルが厳密に t=0.5 に乗り、接線がちょうどゼロになる
    const outT = framesOf(cuspPath, 101, { parameterization: 'segment-t' })
    expect(allFinite(outT)).toBe(true)
    expect(allOrthonormal(outT, 101)).toBe(true)
    expect(() => framesOf(cuspPath, 101, { parameterization: 'segment-t', strict: true })).toThrow(/zero tangent/)
  })

  it('長さ 1e12 のセグメントの後の長さ 1 のセグメントでも、短い方の接線を潰さない(接線ゼロの閾値はセグメント相対)', () => {
    const mixed: BezierPath<Point3D> = {
      start: { x: 0, y: 0, z: 0 },
      segments: [
        { cp1: { x: 3e11, y: 0, z: 0 }, cp2: { x: 7e11, y: 0, z: 0 }, end: { x: 1e12, y: 0, z: 0 } },
        { cp1: { x: 1e12, y: 0.3, z: 0 }, cp2: { x: 1e12, y: 0.7, z: 0 }, end: { x: 1e12, y: 1, z: 0 } },
      ],
    }
    // 末尾サンプルは 2 本目の終点で、接線は +y でなければならない(全長相対の閾値だと +x の前サンプルの接線で上書きされていた)
    const out = framesOf(mixed, 101)
    const last = readRotationMinimizingFrame(out, 100)
    expect(angle(vec(last.tangent), [0, 1, 0])).toBeLessThan(1e-3)
    expect(allOrthonormal(out, 101)).toBe(true)
  })

  it('arcLengthSamples=1 で始点と終点が同じ cubic(弦長ゼロ)でも全長ゼロと誤判定せず、曲線上を進む', () => {
    const closed: BezierPath<Point3D> = {
      start: { x: 0, y: 0, z: 0 },
      segments: [{ cp1: { x: 10, y: 10, z: 0 }, cp2: { x: -10, y: 10, z: 0 }, end: { x: 0, y: 0, z: 0 } }],
    }
    const out = framesOf(closed, 11, { arcLengthSamples: 1 })
    expect(allFinite(out)).toBe(true)
    expect(allOrthonormal(out, 11)).toBe(true)
    const mid = readRotationMinimizingFrame(out, 5).position
    // t=0.5 の位置は (0, 7.5, 0)。全長ゼロ扱いなら始点 (0,0,0) のままになる
    expect(Math.hypot(mid.x, mid.y - 7.5, mid.z)).toBeLessThan(1e-3)
    expect(() => framesOf(closed, 11, { arcLengthSamples: 1, strict: true })).not.toThrow()
  })

  it('位置が一致する隣接サンプル: 接線が同じ向きなら法線は連続、反平行なら前の法線を新しい接線に直交化して保つ', () => {
    // seg1: +x に直進、seg2: ゼロ長、seg3: そのまま +x に直進(同じ向き)
    const same: BezierPath<Point3D> = {
      start: { x: 0, y: 0, z: 0 },
      segments: [
        { cp1: { x: 10, y: 0, z: 0 }, cp2: { x: 20, y: 0, z: 0 }, end: { x: 30, y: 0, z: 0 } },
        { cp1: { x: 30, y: 0, z: 0 }, cp2: { x: 30, y: 0, z: 0 }, end: { x: 30, y: 0, z: 0 } },
        { cp1: { x: 40, y: 0, z: 0 }, cp2: { x: 50, y: 0, z: 0 }, end: { x: 60, y: 0, z: 0 } },
      ],
    }
    const n0: V = [0, 1, 0]
    const outSame = framesOf(same, 61, { parameterization: 'segment-t' }, n0)
    expect(allOrthonormal(outSame, 61)).toBe(true)
    Array.from({ length: 61 }, (_, i) => readRotationMinimizingFrame(outSame, i)).forEach((f) => {
      expect(angle(vec(f.normal), n0)).toBeLessThan(1e-6)
    })
    // seg1: +x に直進、seg2: ゼロ長、seg3: −x に戻る(反平行)
    const back: BezierPath<Point3D> = {
      start: { x: 0, y: 0, z: 0 },
      segments: [
        { cp1: { x: 10, y: 0, z: 0 }, cp2: { x: 20, y: 0, z: 0 }, end: { x: 30, y: 0, z: 0 } },
        { cp1: { x: 30, y: 0, z: 0 }, cp2: { x: 30, y: 0, z: 0 }, end: { x: 30, y: 0, z: 0 } },
        { cp1: { x: 20, y: 0, z: 0 }, cp2: { x: 10, y: 0, z: 0 }, end: { x: 0, y: 0, z: 0 } },
      ],
    }
    const outBack = framesOf(back, 61, { parameterization: 'segment-t' }, n0)
    expect(allFinite(outBack)).toBe(true)
    expect(allOrthonormal(outBack, 61)).toBe(true)
    // 反平行の後も法線は n0 のまま(直交化しても変わらない)
    const last = readRotationMinimizingFrame(outBack, 60)
    expect(angle(vec(last.tangent), [-1, 0, 0])).toBeLessThan(1e-6)
    expect(angle(vec(last.normal), n0)).toBeLessThan(1e-6)
  })

  it('途中にゼロ長セグメントがあっても既定は NaN を出さず直交基底', () => {
    const out = framesOf(withZeroSegment, 51)
    expect(allFinite(out)).toBe(true)
    expect(allOrthonormal(out, 51)).toBe(true)
  })

  it('非常に小さいスケール(1e-6)でも直交基底(閾値がスケール相対)', () => {
    const tiny: BezierPath<Point3D> = fromCatmullRom<Point3D>(
      Array.from({ length: 6 }, (_, i) => ({ x: i * 1e-6, y: Math.sin(i) * 1e-6, z: Math.cos(i) * 1e-6 })),
    )
    const out = framesOf(tiny, 51)
    expect(allFinite(out)).toBe(true)
    expect(allOrthonormal(out, 51)).toBe(true)
  })
})

describe('createRotationMinimizingFrameWriter — 検証と容量', () => {
  it('factory の引数: maxSegments < 1、samples < 2、samples 非整数、arcLengthSamples < 1 は RangeError', () => {
    expect(() => createRotationMinimizingFrameWriter({ maxSegments: 0, samples: 2 })).toThrow(RangeError)
    expect(() => createRotationMinimizingFrameWriter({ maxSegments: 1, samples: 1 })).toThrow(RangeError)
    expect(() => createRotationMinimizingFrameWriter({ maxSegments: 1, samples: 2.5 })).toThrow(RangeError)
    expect(() => createRotationMinimizingFrameWriter({ maxSegments: 1, samples: 2, arcLengthSamples: 0 })).toThrow(
      RangeError,
    )
    expect(() =>
      createRotationMinimizingFrameWriter({
        maxSegments: 1,
        samples: 2,
        parameterization: 'uniform' as unknown as 'arc-length',
      }),
    ).toThrow(RangeError)
  })

  it('write の引数: セグメント数の超過、out 不足、segments 不足、非有限の座標は RangeError', () => {
    const w = createRotationMinimizingFrameWriter({ maxSegments: 2, samples: 4 })
    const out = new Float32Array(4 * RMF_STRIDE)
    expect(() => w.writePath(out, curvy)).toThrow(RangeError) // 19 セグメント > maxSegments 2
    expect(() => w.writePath(new Float32Array(4 * RMF_STRIDE - 1), twistedCubic)).toThrow(RangeError)
    expect(() => w.writeSegments(out, new Float32Array(12), 2)).toThrow(RangeError)
    const nan: BezierPath<Point3D> = {
      start: { x: 0, y: 0, z: 0 },
      segments: [{ cp1: { x: Number.NaN, y: 0, z: 0 }, cp2: { x: 1, y: 1, z: 1 }, end: { x: 2, y: 2, z: 2 } }],
    }
    expect(() => w.writePath(out, nan)).toThrow(RangeError)
    expect(() => w.writePath(out, { start: { x: 0, y: 0, z: 0 }, segments: [] })).toThrow(RangeError)
  })

  it('同じ writer を別の形・別のセグメント数(上限以下)で繰り返し使える', () => {
    const w = createRotationMinimizingFrameWriter({ maxSegments: 19, samples: 11 })
    const out = new Float32Array(11 * RMF_STRIDE)
    w.writePath(out, curvy)
    w.writePath(out, twistedCubic)
    w.writePath(out, helix8)
    const f = readRotationMinimizingFrame(out, 10)
    const end = helix8.segments[helix8.segments.length - 1]!.end
    expect(f.position.x).toBeCloseTo(end.x, 4)
    expect(f.position.z).toBeCloseTo(end.z, 4)
  })
})

describe('computeRotationMinimizingFrames / readRotationMinimizingFrame', () => {
  it('オブジェクト配列版は writer と同じ値を返す', () => {
    const frames = computeRotationMinimizingFrames(curvy, 9)
    const out = framesOf(curvy, 9)
    expect(frames).toHaveLength(9)
    frames.forEach((f, i) => {
      const g = readRotationMinimizingFrame(out, i)
      expect(f).toEqual(g)
    })
  })
})
