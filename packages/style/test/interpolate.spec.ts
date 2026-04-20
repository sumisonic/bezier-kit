import { describe, expect, it } from 'vitest'
import type { StyledBezierPath } from '../src/types'
import { createStrokeLerp, createStyledPathInterpolator } from '../src/interpolate'

const makePath = (x: number, stroke?: StyledBezierPath['stroke']): StyledBezierPath => ({
  path: {
    start: { x, y: 0 },
    segments: [{ cp1: { x: x + 10, y: 50 }, cp2: { x: x + 20, y: 50 }, end: { x: x + 30, y: 0 } }],
  },
  ...(stroke !== undefined && { stroke }),
})

describe('createStrokeLerp', () => {
  it('両方 undefined なら undefined を返す', () => {
    const interp = createStrokeLerp(undefined, undefined)
    expect(interp(0.5)).toBeUndefined()
  })

  it('グラデーションなし同士: width と color を補間する', () => {
    const interp = createStrokeLerp({ width: 2, color: '#000000' }, { width: 6, color: '#ffffff' })
    const mid = interp(0.5)
    expect(mid?.width).toBeCloseTo(4)
    expect(mid?.color).toBe('#808080')
  })

  it('グラデーションあり同士: stop 数が同じ場合に補間する', () => {
    const a = {
      width: 3,
      gradient: {
        x1: 0,
        y1: 0,
        x2: 1,
        y2: 1,
        stops: [
          { offset: 0, color: '#ff0000' },
          { offset: 1, color: '#0000ff' },
        ],
      },
    }
    const b = {
      width: 5,
      gradient: {
        x1: 0,
        y1: 0,
        x2: 1,
        y2: 1,
        stops: [
          { offset: 0, color: '#00ff00' },
          { offset: 1, color: '#ffff00' },
        ],
      },
    }
    const interp = createStrokeLerp(a, b)
    const at0 = interp(0)
    expect(at0?.width).toBeCloseTo(3)
    expect(at0?.gradient?.stops[0]?.color).toBe('#ff0000')

    const at1 = interp(1)
    expect(at1?.width).toBeCloseTo(5)
    expect(at1?.gradient?.stops[0]?.color).toBe('#00ff00')
  })

  it('片方だけグラデーション: 仮グラデーションが生成されて補間する', () => {
    const a = { width: 3, color: '#ff0000' }
    const b = {
      width: 3,
      gradient: {
        x1: 0,
        y1: 0,
        x2: 1,
        y2: 0,
        stops: [
          { offset: 0, color: '#00ff00' },
          { offset: 1, color: '#0000ff' },
        ],
      },
    }
    const interp = createStrokeLerp(a, b)
    const at0 = interp(0)
    expect(at0?.gradient).toBeDefined()
    expect(at0?.gradient?.stops[0]?.color).toBe('#ff0000')

    const at1 = interp(1)
    expect(at1?.gradient?.stops[0]?.color).toBe('#00ff00')
  })

  it('片方だけ stroke がある場合は static 値を返す', () => {
    const interp = createStrokeLerp({ width: 4, color: '#aabbcc' }, undefined)
    const result = interp(0.5)
    expect(result?.width).toBe(4)
    expect(result?.color).toBe('#aabbcc')
  })
})

describe('createStyledPathInterpolator', () => {
  it('t=0 で from を返す', () => {
    const from = makePath(0, { width: 2, color: '#000000' })
    const to = makePath(100, { width: 6, color: '#ffffff' })
    const interp = createStyledPathInterpolator(from, to)
    const result = interp(0)
    expect(result.path.start.x).toBeCloseTo(0)
    expect(result.stroke?.width).toBeCloseTo(2)
    expect(result.stroke?.color).toBe('#000000')
  })

  it('t=1 で to を返す', () => {
    const from = makePath(0, { width: 2, color: '#000000' })
    const to = makePath(100, { width: 6, color: '#ffffff' })
    const interp = createStyledPathInterpolator(from, to)
    const result = interp(1)
    expect(result.path.start.x).toBeCloseTo(100)
    expect(result.stroke?.width).toBeCloseTo(6)
    expect(result.stroke?.color).toBe('#ffffff')
  })

  it('t=0.5 で中間値を返す', () => {
    const from = makePath(0, { width: 2, color: '#000000' })
    const to = makePath(100, { width: 6, color: '#ffffff' })
    const interp = createStyledPathInterpolator(from, to)
    const result = interp(0.5)
    expect(result.path.start.x).toBeCloseTo(50)
    expect(result.stroke?.width).toBeCloseTo(4)
  })

  it('セグメント数が異なるパスでも補間できる', () => {
    const from: StyledBezierPath = {
      path: {
        start: { x: 0, y: 0 },
        segments: [{ cp1: { x: 10, y: 50 }, cp2: { x: 20, y: 50 }, end: { x: 30, y: 0 } }],
      },
    }
    const to: StyledBezierPath = {
      path: {
        start: { x: 0, y: 0 },
        segments: [
          { cp1: { x: 5, y: 25 }, cp2: { x: 10, y: 25 }, end: { x: 15, y: 0 } },
          { cp1: { x: 20, y: 25 }, cp2: { x: 25, y: 25 }, end: { x: 30, y: 0 } },
        ],
      },
    }
    const interp = createStyledPathInterpolator(from, to)
    const result = interp(0.5)
    expect(result.path.segments).toHaveLength(2)
  })
})
