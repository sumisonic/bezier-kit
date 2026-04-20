import { describe, expect, it } from 'vitest'
import type { StyledBezierPath } from '../src/types'
import { createStyledPathSplitter } from '../src/split'
import { expectPointClose } from './helpers'

const makeGradientPath = (): StyledBezierPath => ({
  path: {
    start: { x: 0, y: 0 },
    segments: [
      { cp1: { x: 0, y: 100 }, cp2: { x: 100, y: 100 }, end: { x: 100, y: 0 } },
      { cp1: { x: 100, y: -100 }, cp2: { x: 200, y: -100 }, end: { x: 200, y: 0 } },
    ],
  },
  stroke: {
    width: 5,
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
  },
})

const makeSimplePath = (): StyledBezierPath => ({
  path: {
    start: { x: 0, y: 0 },
    segments: [{ cp1: { x: 30, y: 50 }, cp2: { x: 70, y: 50 }, end: { x: 100, y: 0 } }],
  },
  stroke: { width: 3, color: '#ffffff' },
})

describe('createStyledPathSplitter', () => {
  it('左の終点と右の始点が一致する', () => {
    const split = createStyledPathSplitter(makeSimplePath())
    const [left, right] = split(0.5)
    const leftEnd = left.path.segments[left.path.segments.length - 1]!.end
    expectPointClose(leftEnd, right.path.start, 4)
  })

  it('stroke が保持される(グラデーションなし)', () => {
    const split = createStyledPathSplitter(makeSimplePath())
    const [left, right] = split(0.5)
    expect(left.stroke?.width).toBe(3)
    expect(left.stroke?.color).toBe('#ffffff')
    expect(right.stroke?.width).toBe(3)
    expect(right.stroke?.color).toBe('#ffffff')
  })

  it('グラデーション付きパスの分割でグラデーションが保持される', () => {
    const split = createStyledPathSplitter(makeGradientPath())
    const [left, right] = split(0.5)
    expect(left.stroke?.gradient).toBeDefined()
    expect(right.stroke?.gradient).toBeDefined()
    expect(left.stroke?.gradient?.stops).toHaveLength(2)
    expect(right.stroke?.gradient?.stops).toHaveLength(2)
  })

  it('分割後のグラデーション座標が remap される', () => {
    const original = makeGradientPath()
    const split = createStyledPathSplitter(original)
    const [left] = split(0.5)
    const origGrad = original.stroke!.gradient!
    const leftGrad = left.stroke!.gradient!
    expect(Number.isFinite(leftGrad.x1)).toBe(true)
    expect(Number.isFinite(leftGrad.y1)).toBe(true)
    expect(Number.isFinite(leftGrad.x2)).toBe(true)
    expect(Number.isFinite(leftGrad.y2)).toBe(true)
    expect(leftGrad.stops[0]?.color).toBe(origGrad.stops[0]?.color)
    expect(leftGrad.stops[1]?.color).toBe(origGrad.stops[1]?.color)
  })

  it('ratio 範囲外は clamp される(createPathSplitter に委譲)', () => {
    const split = createStyledPathSplitter(makeSimplePath())
    const [left0] = split(-5)
    expectPointClose(left0.path.start, { x: 0, y: 0 })
  })
})
