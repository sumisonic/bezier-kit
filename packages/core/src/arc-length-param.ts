import type { BezierSegment, Point } from './types'
import { arcLengthTo, type ArcLengthOptions } from './segment'

/**
 * セグメント内の距離比率(0〜1)をベジェパラメータ `t` に変換する。
 * 二分探索で弧長が目標距離に一致する `t` を求める。
 *
 * `ratio` の clamp はしない(呼び出し側で管理すること)。`ratio <= 0` は `0`、
 * `ratio >= 1` は `1` を即座に返す。
 *
 * ⚠ 各反復の {@link arcLengthTo} は `[0, mid]` を `samples` 等分するため、反復ごとに刻み幅が変わり、
 * `segLen`(全長を `samples` 等分)とも刻みが揃わない。1 回の呼び出しで `iterations × samples` 回の点評価を行う。
 *
 * 2D / 3D 両対応。
 *
 * @param start - セグメントの始点
 * @param seg - 対象のセグメント
 * @param ratio - セグメント内での距離比率(0〜1)
 * @param segLen - 事前計算済みのセグメント弧長
 * @param options - `samples`: 各 `arcLengthTo` 呼び出しの精度、`iterations`: 二分探索の反復回数(デフォルト 15)
 */
export const arcLengthToParam = <P extends Point>(
  start: P,
  seg: BezierSegment<P>,
  ratio: number,
  segLen: number,
  options: ArcLengthOptions & { readonly iterations?: number } = {},
): number => {
  if (ratio <= 0) return 0
  if (ratio >= 1) return 1

  const iterations = options.iterations ?? 15
  const targetLen = segLen * ratio

  const bisect = (lo: number, hi: number, depth: number): number => {
    if (depth === 0) return (lo + hi) / 2
    const mid = (lo + hi) / 2
    return arcLengthTo(start, seg, mid, options) < targetLen ? bisect(mid, hi, depth - 1) : bisect(lo, mid, depth - 1)
  }

  return bisect(0, 1, iterations)
}
