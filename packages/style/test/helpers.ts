import { expect } from 'vitest'
import type { Point } from '@sumisonic/bezier-kit-core'

/**
 * 2 つの {@link Point} が指定精度で一致することを検証する。
 */
export const expectPointClose = (actual: Point, expected: Point, precision = 6): void => {
  expect(actual.x).toBeCloseTo(expected.x, precision)
  expect(actual.y).toBeCloseTo(expected.y, precision)
}
