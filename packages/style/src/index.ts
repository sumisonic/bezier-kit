/**
 * @sumisonic/bezier-kit-style
 *
 * スタイル付きベジェパスの補間・分割(色・グラデーション・ストローク)。
 * `@sumisonic/bezier-kit-core` にのみ依存する。
 */

export type { GradientStop, LinearGradient, StrokeStyle, StyledBezierPath, ViewBox, StyledBezierData } from './types'
export { parseHexColor, toHexColor, lerpColor, createColorLerp } from './color'
export { gradientToAbsolute, remapGradient } from './gradient'
export { createStrokeLerp, createStyledPathInterpolator } from './interpolate'
export { createStyledPathSplitter } from './split'
export { matchStyledPathCount } from './match-count'
