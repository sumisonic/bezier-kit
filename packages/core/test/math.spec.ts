import { describe, expect, it } from 'vitest'
import type { Point3D } from '../src/types'
import { binarySearchIndex, clamp, distance, lerp, lerpPoint, scan } from '../src/math'
import { expectPointClose } from './helpers'

describe('lerp', () => {
  it('t=0 で a を返す', () => {
    expect(lerp(10, 20, 0)).toBe(10)
  })

  it('t=1 で b を返す', () => {
    expect(lerp(10, 20, 1)).toBe(20)
  })

  it('t=0.5 で中間値を返す', () => {
    expect(lerp(0, 100, 0.5)).toBe(50)
  })

  it('t > 1 で外挿される(Back/Elastic 対応)', () => {
    expect(lerp(0, 100, 1.5)).toBe(150)
  })

  it('t < 0 で外挿される(Back/Elastic 対応)', () => {
    expect(lerp(0, 100, -0.5)).toBe(-50)
  })
})

describe('clamp', () => {
  it('範囲内の値はそのまま返す', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('下限を下回る場合は下限を返す', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('上限を上回る場合は上限を返す', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('境界値と一致する場合はそのまま返す', () => {
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })
})

describe('lerpPoint (2D)', () => {
  it('t=0 で始点を返す', () => {
    expectPointClose(lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0), { x: 0, y: 0 })
  })

  it('t=1 で終点を返す', () => {
    expectPointClose(lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 1), { x: 10, y: 20 })
  })

  it('t=0.5 で中間点を返す', () => {
    expectPointClose(lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5), { x: 5, y: 10 })
  })
})

describe('lerpPoint (3D)', () => {
  const a: Point3D = { x: 0, y: 0, z: 0 }
  const b: Point3D = { x: 10, y: 20, z: 30 }

  it('t=0 で始点を返す(z も含む)', () => {
    const r = lerpPoint(a, b, 0)
    expect(r).toEqual(a)
  })

  it('t=1 で終点を返す(z も含む)', () => {
    const r = lerpPoint(a, b, 1)
    expect(r).toEqual(b)
  })

  it('t=0.5 で全成分が中間値', () => {
    const r = lerpPoint(a, b, 0.5)
    expect(r).toEqual({ x: 5, y: 10, z: 15 })
  })
})

describe('distance (2D)', () => {
  it('同じ点の距離は 0', () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0)
  })

  it('水平距離', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3)
  })

  it('3-4-5 三角形の斜辺', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

describe('distance (3D)', () => {
  it('同じ点の距離は 0', () => {
    expect(distance<Point3D>({ x: 5, y: 5, z: 5 }, { x: 5, y: 5, z: 5 })).toBe(0)
  })

  it('z 軸方向の距離', () => {
    expect(distance<Point3D>({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 3 })).toBe(3)
  })

  it('3D 対角線 (3, 4, 12) の距離は 13', () => {
    expect(distance<Point3D>({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 12 })).toBe(13)
  })
})

describe('scan', () => {
  it('空配列には空配列を返す', () => {
    expect(scan([], 0, (acc, v: number) => acc + v)).toEqual([])
  })

  it('加算 scan で累積和の配列になる', () => {
    expect(scan([1, 2, 3, 4], 0, (acc, v) => acc + v)).toEqual([1, 3, 6, 10])
  })

  it('初期値が加算に反映される', () => {
    expect(scan([1, 2, 3], 10, (acc, v) => acc + v)).toEqual([11, 13, 16])
  })

  it('index をコールバックに渡す', () => {
    const result = scan(['a', 'b', 'c'], '', (acc, v, i) => `${acc}${i}${v}`)
    expect(result).toEqual(['0a', '0a1b', '0a1b2c'])
  })
})

describe('binarySearchIndex', () => {
  const arr = [1, 3, 5, 7, 9]

  it('target 以上の最小要素のインデックスを返す(lower bound)', () => {
    expect(binarySearchIndex(arr, 4)).toBe(2)
    expect(binarySearchIndex(arr, 6)).toBe(3)
  })

  it('target と完全一致する要素があればそのインデックスを返す', () => {
    expect(binarySearchIndex(arr, 5)).toBe(2)
  })

  it('全要素より小さい target では 0 を返す', () => {
    expect(binarySearchIndex(arr, 0)).toBe(0)
  })

  it('全要素より大きい target では arr.length を返す', () => {
    expect(binarySearchIndex(arr, 100)).toBe(arr.length)
  })

  it('空配列では 0 を返す', () => {
    expect(binarySearchIndex([], 5)).toBe(0)
  })

  it('同値が複数ある場合は最小インデックスを返す', () => {
    expect(binarySearchIndex([1, 2, 2, 2, 3], 2)).toBe(1)
  })
})
