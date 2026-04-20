import type { Point2D } from '@sumisonic/bezier-kit-core'
import type { StyledBezierPath } from './types'
import { createStyledPathSplitter } from './split'

/**
 * 1 つのパスを `count` 個に均等分割する(残り比率の再帰的な等分)。
 *
 * `createStyledPathSplitter` を繰り返し適用し、毎回残りを `1/(count - j)`
 * の比率で切り出す。これにより最終的に N 個の弧長等分パスが得られる。
 *
 * @param path - 分割対象のパス
 * @param count - 分割後のパス数
 */
const splitLastPath = <P extends Point2D>(path: StyledBezierPath<P>, count: number): readonly StyledBezierPath<P>[] => {
  const { parts, remaining } = Array.from({ length: count - 1 }).reduce<{
    readonly parts: readonly StyledBezierPath<P>[]
    readonly remaining: StyledBezierPath<P>
  }>(
    (acc, _, j) => {
      const [left, right] = createStyledPathSplitter(acc.remaining)(1 / (count - j))
      return { parts: [...acc.parts, left], remaining: right }
    },
    { parts: [], remaining: path },
  )
  return [...parts, remaining]
}

/**
 * {@link StyledBezierPath} 配列のパス数を `targetCount` に揃える。
 *
 * - パスが少ない場合: 末尾のパスを弧長等分で分割して補う
 * - パスが多い場合: 先頭から `targetCount` 個を返す
 *
 * 型パラメータ `P` は `Point2D` の派生に制約される(2D 限定)。
 *
 * @param paths - 元のパス配列
 * @param targetCount - 目標パス数
 */
export const matchStyledPathCount = <P extends Point2D = Point2D>(
  paths: readonly StyledBezierPath<P>[],
  targetCount: number,
): readonly StyledBezierPath<P>[] => {
  if (paths.length === targetCount) return [...paths]
  if (paths.length > targetCount) return paths.slice(0, targetCount)
  if (paths.length === 0) throw new Error('matchStyledPathCount: paths must not be empty')

  const head = paths.slice(0, -1)
  const last = paths[paths.length - 1]!
  return [...head, ...splitLastPath(last, targetCount - head.length)]
}
