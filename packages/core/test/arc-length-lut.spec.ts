import { describe, expect, it } from 'vitest'
import type { BezierPath, Point, Point2D, Point3D } from '../src/types'
import { createArcLengthIndex, createArcLengthParameterizer } from '../src/arc-length'
import { arcLengthToParam } from '../src/arc-length-param'
import { arcLengthTo, pointAt, segmentLength } from '../src/segment'
import { fromCatmullRom } from '../src/path/from'

/**
 * createArcLengthParameterizer の LUT 逆変換を、
 * (1) 不変条件、(2) 高精度参照との比較、(3) 退化ケース、の 3 層で検査する。
 *
 * 参照は「4096 分割の index + 4096 サンプル・40 反復の二分探索」= 旧アルゴリズム(arcLengthToParam)を
 * 高精度に回したもの。許容値は 2026-09-20 に corpus で測った最大誤差の約 5 倍(保証値ではなく回帰検知用)。
 */

const cr = <P extends Point>(pts: readonly P[]): BezierPath<P> => fromCatmullRom<P>(pts)

type Case = { readonly name: string; readonly path: BezierPath<Point2D> | BezierPath<Point3D>; readonly tol: Tol }
type Tol = { readonly dt: number; readonly pos: number; readonly arc: number }
const SMOOTH: Tol = { dt: 5e-4, pos: 3e-5, arc: 3e-5 }
const HARD: Tol = { dt: 1e-2, pos: 1.5e-3, arc: 2e-3 }

const corpus: readonly Case[] = [
  {
    name: 'smooth 3D catmull-rom (20 点)',
    path: cr<Point3D>(
      Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: Math.sin(i * 0.4) * 40, z: Math.cos(i * 0.3) * 20 })),
    ),
    tol: SMOOTH,
  },
  {
    name: 'curvy 2D catmull-rom (12 点)',
    path: cr<Point2D>(Array.from({ length: 12 }, (_, i) => ({ x: i * 10, y: Math.sin(i * 0.5) * 15 }))),
    tol: SMOOTH,
  },
  {
    name: 'tight loop 2D(制御点が大きく行き来する)',
    path: {
      start: { x: 0, y: 0 },
      segments: [
        { cp1: { x: 300, y: 0 }, cp2: { x: -200, y: 0 }, end: { x: 100, y: 0 } },
        { cp1: { x: 120, y: 5 }, cp2: { x: 140, y: -5 }, end: { x: 160, y: 0 } },
      ],
    },
    tol: HARD,
  },
  {
    name: 'uneven handles 2D(ハンドル長が極端に偏る)',
    path: {
      start: { x: 0, y: 0 },
      segments: [
        { cp1: { x: 1, y: 1 }, cp2: { x: 199, y: 199 }, end: { x: 200, y: 200 } },
        { cp1: { x: 200, y: 200 }, cp2: { x: 200, y: 200 }, end: { x: 400, y: 0 } },
      ],
    },
    tol: HARD,
  },
  {
    name: 'cusp 2D',
    path: {
      start: { x: 0, y: 0 },
      segments: [{ cp1: { x: 100, y: 100 }, cp2: { x: 0, y: 100 }, end: { x: 100, y: 0 } }],
    },
    tol: HARD,
  },
  {
    name: 'huge scale 2D (1e6)',
    path: cr<Point2D>(Array.from({ length: 6 }, (_, i) => ({ x: i * 1e6, y: Math.sin(i) * 1e6 }))),
    tol: SMOOTH,
  },
  {
    name: 'tiny scale 2D (1e-6)',
    path: cr<Point2D>(Array.from({ length: 6 }, (_, i) => ({ x: i * 1e-6, y: Math.sin(i) * 1e-6 }))),
    tol: SMOOTH,
  },
]

const bboxDiagonal = (path: BezierPath<Point>): number => {
  const pts = [path.start, ...path.segments.flatMap((s) => [s.cp1, s.cp2, s.end])]
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const zs = pts.map((p) => ('z' in p ? p.z : 0))
  const d = Math.hypot(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    Math.max(...zs) - Math.min(...zs),
  )
  return d > 0 ? d : 1
}
const dist = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y, ('z' in a ? a.z : 0) - ('z' in b ? b.z : 0))

const RATIOS = Array.from({ length: 401 }, (_, k) => k / 400)

describe('createArcLengthParameterizer — 不変条件', () => {
  it.each(corpus)('$name: lengths は segmentLength と浮動小数まで一致し、createArcLengthIndex と同じ', ({ path }) => {
    const { index } = createArcLengthParameterizer(path as BezierPath<Point>)
    const plain = createArcLengthIndex(path as BezierPath<Point>)
    index.lengths.forEach((l, i) => {
      expect(l).toBe(segmentLength(index.startPoints[i]!, path.segments[i]!))
      expect(l).toBe(plain.lengths[i])
    })
    expect(index.totalLength).toBe(plain.totalLength)
  })

  it.each(corpus)('$name: locateParam は ratio に対して (segmentIndex, t) が単調非減少', ({ path }) => {
    const { locateParam } = createArcLengthParameterizer(path as BezierPath<Point>)
    const seq = RATIOS.map((r) => locateParam(r))
    seq.slice(1).forEach((cur, i) => {
      const prev = seq[i]!
      const ok = cur.segmentIndex > prev.segmentIndex || (cur.segmentIndex === prev.segmentIndex && cur.t >= prev.t)
      expect(ok).toBe(true)
    })
  })

  it.each(corpus)('$name: 端点は厳密(0 → 先頭 t=0、1 → 末尾 t=1)、範囲外は clamp、NaN は 0', ({ path }) => {
    const { locateParam } = createArcLengthParameterizer(path as BezierPath<Point>)
    const last = path.segments.length - 1
    expect(locateParam(0)).toEqual({ segmentIndex: 0, t: 0 })
    expect(locateParam(1)).toEqual({ segmentIndex: last, t: 1 })
    expect(locateParam(-3)).toEqual({ segmentIndex: 0, t: 0 })
    expect(locateParam(7)).toEqual({ segmentIndex: last, t: 1 })
    expect(locateParam(Number.NaN)).toEqual({ segmentIndex: 0, t: 0 })
  })

  it.each(corpus)('$name: t は常に [0, 1] で有限', ({ path }) => {
    const { locateParam } = createArcLengthParameterizer(path as BezierPath<Point>)
    RATIOS.forEach((r) => {
      const { t } = locateParam(r)
      expect(Number.isFinite(t)).toBe(true)
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThanOrEqual(1)
    })
  })
})

describe('createArcLengthParameterizer — 高精度参照との比較', () => {
  // 参照 1(軽い): 4096 分割の表を持つ parameterizer。同じ方式の高解像度版で、401 点を走査する
  it.each(corpus)('$name: 4096 分割の表を参照に |Δt| / 位置誤差 / 相対弧長誤差が許容内(401 点)', ({ path, tol }) => {
    const p = path as BezierPath<Point>
    const diag = bboxDiagonal(p)
    const { locateParam } = createArcLengthParameterizer(p)
    const fine = createArcLengthParameterizer(p, { samples: 4096 })

    const worst = RATIOS.reduce(
      (acc, r) => {
        const { segmentIndex: i, t } = locateParam(r)
        const ref = fine.locateParam(r)
        const dt = ref.segmentIndex === i ? Math.abs(ref.t - t) : 0
        const pNew = pointAt(fine.index.startPoints[i]!, p.segments[i]!, t)
        const pRef = pointAt(fine.index.startPoints[ref.segmentIndex]!, p.segments[ref.segmentIndex]!, ref.t)
        const pos = dist(pNew, pRef) / diag
        const cum = i > 0 ? fine.index.cumulativeLengths[i - 1]! : 0
        const total = fine.index.totalLength
        const arc =
          total > 0
            ? Math.abs(
                cum + arcLengthTo(fine.index.startPoints[i]!, p.segments[i]!, t, { samples: 4096 }) - r * total,
              ) / total
            : 0
        return { dt: Math.max(acc.dt, dt), pos: Math.max(acc.pos, pos), arc: Math.max(acc.arc, arc) }
      },
      { dt: 0, pos: 0, arc: 0 },
    )

    expect(worst.dt).toBeLessThanOrEqual(tol.dt)
    expect(worst.pos).toBeLessThanOrEqual(tol.pos)
    expect(worst.arc).toBeLessThanOrEqual(tol.arc)
  })

  // 参照 2(独立): 旧アルゴリズム arcLengthToParam を 4096 サンプル・40 反復で回した二分探索。重いので 21 点だけ
  it.each(corpus)('$name: 二分探索(4096 サンプル × 40 反復)を参照に |Δt| が許容内(21 点)', ({ path, tol }) => {
    const p = path as BezierPath<Point>
    const { locateParam } = createArcLengthParameterizer(p)
    const ref = createArcLengthIndex(p, { samples: 4096 })
    const ratios = Array.from({ length: 21 }, (_, k) => k / 20)

    const worst = ratios.reduce((acc, r) => {
      const { segmentIndex: i, t } = locateParam(r)
      const loc = ref.locate(r)
      if (loc.segmentIndex !== i) return acc
      const refT = arcLengthToParam(ref.startPoints[i]!, p.segments[i]!, loc.localRatio, ref.lengths[i]!, {
        samples: 4096,
        iterations: 40,
      })
      return Math.max(acc, Math.abs(refT - t))
    }, 0)

    expect(worst).toBeLessThanOrEqual(tol.dt)
  })
})

describe('createArcLengthParameterizer — 退化ケース', () => {
  it('ゼロ長セグメントを含むパスで NaN を出さず、ゼロ長セグメントの中では t=0', () => {
    const path: BezierPath<Point2D> = {
      start: { x: 0, y: 0 },
      segments: [
        { cp1: { x: 0, y: 0 }, cp2: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
        { cp1: { x: 10, y: 0 }, cp2: { x: 20, y: 0 }, end: { x: 30, y: 0 } },
      ],
    }
    const { index, locateParam } = createArcLengthParameterizer(path)
    expect(index.lengths[0]).toBe(0)
    RATIOS.forEach((r) => {
      const { segmentIndex, t } = locateParam(r)
      expect(Number.isFinite(t)).toBe(true)
      if (segmentIndex === 0) expect(t).toBe(0)
    })
    expect(locateParam(0.5)).toEqual({ segmentIndex: 1, t: 0.5 })
  })

  it('全長ゼロのパス(全セグメントがゼロ長)でも安全', () => {
    const path: BezierPath<Point2D> = {
      start: { x: 1, y: 1 },
      segments: [{ cp1: { x: 1, y: 1 }, cp2: { x: 1, y: 1 }, end: { x: 1, y: 1 } }],
    }
    const { index, locateParam } = createArcLengthParameterizer(path)
    expect(index.totalLength).toBe(0)
    expect(locateParam(0.5)).toEqual({ segmentIndex: 0, t: 0 })
  })

  it('空のパスでは segmentIndex=-1、t=0(呼び出し側が事前に弾く前提)', () => {
    const { locateParam } = createArcLengthParameterizer<Point2D>({ start: { x: 0, y: 0 }, segments: [] })
    expect(locateParam(0.5)).toEqual({ segmentIndex: -1, t: 0 })
  })

  it('samples を変えても端点と単調性は保たれる(samples=4)', () => {
    const path = corpus[1]!.path as BezierPath<Point2D>
    const { locateParam } = createArcLengthParameterizer(path, { samples: 4 })
    expect(locateParam(0)).toEqual({ segmentIndex: 0, t: 0 })
    expect(locateParam(1)).toEqual({ segmentIndex: path.segments.length - 1, t: 1 })
    const seq = RATIOS.map((r) => locateParam(r))
    seq.slice(1).forEach((cur, i) => {
      const prev = seq[i]!
      expect(cur.segmentIndex > prev.segmentIndex || (cur.segmentIndex === prev.segmentIndex && cur.t >= prev.t)).toBe(
        true,
      )
    })
  })

  it('samples=1 でも端点と単調性は保たれる(表は 2 点、区間内は線形)', () => {
    const path = corpus[0]!.path as BezierPath<Point3D>
    const { index, locateParam } = createArcLengthParameterizer(path, { samples: 1 })
    index.lengths.forEach((l, i) =>
      expect(l).toBe(segmentLength(index.startPoints[i]!, path.segments[i]!, { samples: 1 })),
    )
    expect(locateParam(0)).toEqual({ segmentIndex: 0, t: 0 })
    expect(locateParam(1)).toEqual({ segmentIndex: path.segments.length - 1, t: 1 })
    const seq = RATIOS.map((r) => locateParam(r))
    seq.slice(1).forEach((cur, i) => {
      const prev = seq[i]!
      expect(cur.segmentIndex > prev.segmentIndex || (cur.segmentIndex === prev.segmentIndex && cur.t >= prev.t)).toBe(
        true,
      )
    })
  })

  it('samples が 1 以上の整数でなければ RangeError(parameterizer / index / arcLengthTo)', () => {
    const path = corpus[1]!.path as BezierPath<Point2D>
    const sp = path.start
    const seg = path.segments[0]!
    ;[0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY].forEach((samples) => {
      expect(() => createArcLengthParameterizer(path, { samples })).toThrow(RangeError)
      expect(() => createArcLengthIndex(path, { samples })).toThrow(RangeError)
      expect(() => arcLengthTo(sp, seg, 1, { samples })).toThrow(RangeError)
    })
  })
})
