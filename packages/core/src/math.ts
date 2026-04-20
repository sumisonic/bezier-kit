import type { Point } from './types'

/**
 * 2 つの数値の線形補間。`t=0` で `a`、`t=1` で `b` を返す。
 *
 * `t` は 0〜1 の範囲外も許容し、そのまま外挿される。Back / Elastic 系 easing で
 * `t` が範囲外になっても自然に動作するのはこのため。
 *
 * @param a - 始点の値
 * @param b - 終点の値
 * @param t - 補間係数(範囲外も可)
 */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * 値を `min`〜`max` の範囲に収める。
 *
 * @param v - 対象の値
 * @param min - 下限
 * @param max - 上限
 */
export const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max)

/**
 * 2 点間の線形補間。`t=0` で `a`、`t=1` で `b` を返す。
 * `t` は範囲外も許容し外挿される。
 *
 * 型パラメータ `P` により、2 つの点の次元(2D / 3D)が一致していることが
 * 型レベルで保証される。戻り値も同じ次元。
 *
 * @param a - 始点
 * @param b - 終点
 * @param t - 補間係数
 */
export const lerpPoint = <P extends Point>(a: P, b: P, t: number): P =>
  ('z' in a && 'z' in b
    ? {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        z: lerp(a.z, b.z, t),
      }
    : {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
      }) as P

/**
 * 2 点間のユークリッド距離。2D / 3D 両対応。
 *
 * @param a - 点 1
 * @param b - 点 2
 */
export const distance = <P extends Point>(a: P, b: P): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if ('z' in a && 'z' in b) {
    const dz = b.z - a.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 配列の累積結果を純粋関数で生成する(scan 相当)。
 *
 * `reduce` と異なり、各ステップの中間結果を配列として返す。例えば `[1, 2, 3]` を
 * 初期値 `0` で加算 scan すると `[1, 3, 6]`(= `[0+1, 0+1+2, 0+1+2+3]`)になる。
 *
 * 弧長の累積配列の O(N) 構築に用いる。
 *
 * @param items - 入力配列
 * @param initial - 畳み込みの初期値
 * @param reducer - 現在の累積と要素から次の累積を計算する関数
 * @returns 各要素適用後の累積値の配列(長さ `items.length`)
 */
export const scan = <T, U>(
  items: readonly T[],
  initial: U,
  reducer: (acc: U, item: T, index: number) => U,
): readonly U[] =>
  items.reduce<readonly U[]>((acc, item, i) => {
    const prev = i === 0 ? initial : acc[acc.length - 1]
    const next = reducer(prev as U, item, i)
    return [...acc, next]
  }, [])

/**
 * 昇順ソート済みの数値配列 `arr` に対して、`arr[i] >= target` となる
 * 最小のインデックス `i` を二分探索で返す。全要素が `target` 未満なら `arr.length` を返す。
 *
 * 線形の `Array#findIndex` を置き換え、弧長累積配列の位置特定に用いる。
 * 比較は `>=` なので同値はヒット側を返す(lower bound)。
 *
 * @param arr - 昇順ソート済みの数値配列
 * @param target - 検索対象の値
 */
export const binarySearchIndex = (arr: readonly number[], target: number): number => {
  const search = (lo: number, hi: number): number => {
    if (lo >= hi) return lo
    const mid = (lo + hi) >>> 1
    const v = arr[mid]
    return v !== undefined && v < target ? search(mid + 1, hi) : search(lo, mid)
  }
  return search(0, arr.length)
}
