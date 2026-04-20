import { expect } from 'vitest'
import type { Point } from '../src/types'

/**
 * 2 つの {@link Point} が指定精度で一致することを検証する。
 * 浮動小数誤差を吸収するため `toBeCloseTo(value, precision)` を内部で使う。
 *
 * @param actual - 実測値
 * @param expected - 期待値
 * @param precision - 一致させる小数桁数(デフォルト: 6)
 */
export const expectPointClose = (actual: Point, expected: Point, precision = 6): void => {
  expect(actual.x).toBeCloseTo(expected.x, precision)
  expect(actual.y).toBeCloseTo(expected.y, precision)
}
