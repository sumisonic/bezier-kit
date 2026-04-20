import { describe, expect, it } from 'vitest'
import type { BBox2D } from '@sumisonic/bezier-kit-core'
import { gradientToAbsolute, remapGradient } from '../src/gradient'
import type { LinearGradient } from '../src/types'

const grad: LinearGradient = {
  x1: 0,
  y1: 0,
  x2: 1,
  y2: 1,
  stops: [
    { offset: 0, color: '#ff0000' },
    { offset: 1, color: '#0000ff' },
  ],
}

const bbox: BBox2D = { minX: 10, minY: 20, width: 100, height: 50 }

describe('gradientToAbsolute', () => {
  it('(0,0)→(1,1) を bbox の対角線に変換する', () => {
    const { start, end } = gradientToAbsolute(grad, bbox)
    expect(start).toEqual({ x: 10, y: 20 })
    expect(end).toEqual({ x: 110, y: 70 })
  })
})

describe('remapGradient', () => {
  it('同じ bbox で remap すると元と等しい', () => {
    const remapped = remapGradient(grad, bbox, bbox)
    expect(remapped.x1).toBeCloseTo(grad.x1)
    expect(remapped.y1).toBeCloseTo(grad.y1)
    expect(remapped.x2).toBeCloseTo(grad.x2)
    expect(remapped.y2).toBeCloseTo(grad.y2)
  })

  it('bbox が 2 倍になると相対座標は半分になる', () => {
    const bigger: BBox2D = { minX: 10, minY: 20, width: 200, height: 100 }
    const remapped = remapGradient(grad, bbox, bigger)
    // bbox 内の絶対座標(10,20)→(110,70) を bigger 内の相対座標に変換
    expect(remapped.x1).toBeCloseTo(0, 6)
    expect(remapped.y1).toBeCloseTo(0, 6)
    expect(remapped.x2).toBeCloseTo(0.5, 6)
    expect(remapped.y2).toBeCloseTo(0.5, 6)
  })

  it('width/height 0 でも crash しない(ゼロ除算対策)', () => {
    const zero: BBox2D = { minX: 0, minY: 0, width: 0, height: 0 }
    const remapped = remapGradient(grad, bbox, zero)
    expect(Number.isFinite(remapped.x1)).toBe(true)
    expect(Number.isFinite(remapped.y2)).toBe(true)
  })

  it('stops はそのまま渡される', () => {
    const remapped = remapGradient(grad, bbox, bbox)
    expect(remapped.stops).toBe(grad.stops)
  })
})
