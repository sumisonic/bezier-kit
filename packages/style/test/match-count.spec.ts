import { describe, expect, it } from 'vitest'
import type { StyledBezierPath } from '../src/types'
import { matchStyledPathCount } from '../src/match-count'

const makePath = (startX: number): StyledBezierPath => ({
  path: {
    start: { x: startX, y: 0 },
    segments: [{ cp1: { x: startX + 10, y: 50 }, cp2: { x: startX + 20, y: 50 }, end: { x: startX + 30, y: 0 } }],
  },
  stroke: { width: 3, color: '#ffffff' },
})

describe('matchStyledPathCount', () => {
  it('パス数が一致している場合はそのまま返す', () => {
    const paths = [makePath(0), makePath(50)]
    const result = matchStyledPathCount(paths, 2)
    expect(result).toHaveLength(2)
    expect(result[0]?.path.start.x).toBe(0)
    expect(result[1]?.path.start.x).toBe(50)
  })

  it('パス数が多い場合は先頭から targetCount 個を返す', () => {
    const paths = [makePath(0), makePath(50), makePath(100)]
    const result = matchStyledPathCount(paths, 2)
    expect(result).toHaveLength(2)
    expect(result[0]?.path.start.x).toBe(0)
    expect(result[1]?.path.start.x).toBe(50)
  })

  it('パス数が少ない場合は最後のパスを分割して補う', () => {
    const paths = [makePath(0)]
    const result = matchStyledPathCount(paths, 3)
    expect(result).toHaveLength(3)
  })

  it('分割後のパスが連続している(前のパスの終点 = 次のパスの始点)', () => {
    const paths = [makePath(0)]
    const result = matchStyledPathCount(paths, 3)
    const end0 = result[0]!.path.segments[result[0]!.path.segments.length - 1]!.end
    const end1 = result[1]!.path.segments[result[1]!.path.segments.length - 1]!.end
    expect(end0.x).toBeCloseTo(result[1]!.path.start.x, 4)
    expect(end0.y).toBeCloseTo(result[1]!.path.start.y, 4)
    expect(end1.x).toBeCloseTo(result[2]!.path.start.x, 4)
    expect(end1.y).toBeCloseTo(result[2]!.path.start.y, 4)
  })

  it('先頭のパスは保持され、最後のパスだけが分割される', () => {
    const paths = [makePath(0), makePath(100)]
    const result = matchStyledPathCount(paths, 4)
    expect(result).toHaveLength(4)
    expect(result[0]?.path.start.x).toBe(0)
    expect(result[1]?.path.start.x).toBeCloseTo(100, 0)
  })

  it('stroke が保持される', () => {
    const paths = [makePath(0)]
    const result = matchStyledPathCount(paths, 2)
    result.forEach((p) => {
      expect(p.stroke?.width).toBe(3)
    })
  })

  it('空配列は throw', () => {
    expect(() => matchStyledPathCount([], 3)).toThrow()
  })
})
