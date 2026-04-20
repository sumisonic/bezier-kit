import type { BezierPath, BezierSegment, Point, Point3D } from './types'
import { distance, lerpPoint } from './math'

/**
 * 弧長計算のサンプリング精度オプション。
 */
export type ArcLengthOptions = {
  /**
   * 弧長近似に使用するサンプリング数。
   * 数が多いほど精度が高いが遅くなる。デフォルト: 64。
   */
  readonly samples?: number
}

/** 弧長計算のデフォルトサンプリング数。 */
const DEFAULT_SAMPLES = 64

const is3D = (p: Point): p is Point3D => 'z' in p

/**
 * 3 次ベジェ曲線上のパラメータ `t`(0〜1、外挿可)における座標を返す。
 *
 * `t` は範囲外も許容し、多項式がそのまま外挿される。
 * `(1-t)` を `mt` にキャッシュし乗算を抑えている。
 *
 * 2D / 3D 両対応: 入力の次元で出力の次元が決まる。
 *
 * 実装内の `as unknown as P` は、`is3D` で実行時に型を振り分けていても
 * TypeScript のジェネリクス型パラメータ `P` が narrow されない制約を回避するため。
 * ランタイムでは `P` と一致するオブジェクトを返している。
 *
 * @param start - セグメントの始点
 * @param seg - ベジェセグメント
 * @param t - パラメータ(0〜1 の外も可)
 */
export const pointAt = <P extends Point>(start: P, seg: BezierSegment<P>, t: number): P => {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  const mt3 = mt2 * mt
  const t3 = t2 * t
  const x = mt3 * start.x + 3 * mt2 * t * seg.cp1.x + 3 * mt * t2 * seg.cp2.x + t3 * seg.end.x
  const y = mt3 * start.y + 3 * mt2 * t * seg.cp1.y + 3 * mt * t2 * seg.cp2.y + t3 * seg.end.y
  if (is3D(start) && is3D(seg.cp1) && is3D(seg.cp2) && is3D(seg.end)) {
    const z = mt3 * start.z + 3 * mt2 * t * seg.cp1.z + 3 * mt * t2 * seg.cp2.z + t3 * seg.end.z
    return { x, y, z } as unknown as P
  }
  return { x, y } as unknown as P
}

/**
 * 3 次ベジェ曲線の接線ベクトル(= 導関数 `B'(t)`)をパラメータ `t` で求める。
 *
 * 解析的に計算するため、数値微分のように精度パラメータを必要としない。
 * `tangentAtLength` の計算はこの関数を利用する。
 *
 * 接線ゼロ(cusp: `B'(t) = (0, 0)` や `(0, 0, 0)`)が返る場合の扱いは
 * 呼び出し側の責務とする。
 *
 * 実装内の `as unknown as P` の理由は {@link pointAt} と同じ(TS の
 * ジェネリクス narrowing 制約回避)。
 *
 * @param start - セグメントの始点
 * @param seg - ベジェセグメント
 * @param t - パラメータ(0〜1 の外も可)
 * @returns 接線ベクトル(進行方向、大きさは一般に 1 ではない)
 */
export const tangentAt = <P extends Point>(start: P, seg: BezierSegment<P>, t: number): P => {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  const x = 3 * mt2 * (seg.cp1.x - start.x) + 6 * mt * t * (seg.cp2.x - seg.cp1.x) + 3 * t2 * (seg.end.x - seg.cp2.x)
  const y = 3 * mt2 * (seg.cp1.y - start.y) + 6 * mt * t * (seg.cp2.y - seg.cp1.y) + 3 * t2 * (seg.end.y - seg.cp2.y)
  if (is3D(start) && is3D(seg.cp1) && is3D(seg.cp2) && is3D(seg.end)) {
    const z = 3 * mt2 * (seg.cp1.z - start.z) + 6 * mt * t * (seg.cp2.z - seg.cp1.z) + 3 * t2 * (seg.end.z - seg.cp2.z)
    return { x, y, z } as unknown as P
  }
  return { x, y } as unknown as P
}

/**
 * De Casteljau アルゴリズムで 1 セグメントをパラメータ `t` で 2 分割する。
 *
 * `t` は通常 0〜1。分割点は左セグメントの `end` と右セグメントの始点に一致する。
 *
 * @param start - セグメントの始点
 * @param seg - 分割対象のセグメント
 * @param t - 分割位置のパラメータ
 * @returns `[前半セグメント, 後半セグメント]`
 */
export const splitSegmentAt = <P extends Point>(
  start: P,
  seg: BezierSegment<P>,
  t: number,
): readonly [BezierSegment<P>, BezierSegment<P>] => {
  const p01 = lerpPoint(start, seg.cp1, t)
  const p12 = lerpPoint(seg.cp1, seg.cp2, t)
  const p23 = lerpPoint(seg.cp2, seg.end, t)
  const p012 = lerpPoint(p01, p12, t)
  const p123 = lerpPoint(p12, p23, t)
  const p0123 = lerpPoint(p012, p123, t)

  return [
    { cp1: p01, cp2: p012, end: p0123 },
    { cp1: p123, cp2: p23, end: seg.end },
  ]
}

/**
 * `start` からセグメント上のパラメータ `tEnd`(0〜1)までの弧長を近似計算する。
 *
 * 線形サンプリングによる近似のため `tEnd * samples` 個の直線距離を合計する。
 * 精度を上げるには `options.samples` を増やす。
 *
 * @param start - セグメントの始点
 * @param seg - ベジェセグメント
 * @param tEnd - 計測終了パラメータ(0〜1)
 * @param options - サンプリング精度
 */
export const arcLengthTo = <P extends Point>(
  start: P,
  seg: BezierSegment<P>,
  tEnd: number,
  options: ArcLengthOptions = {},
): number => {
  const samples = options.samples ?? DEFAULT_SAMPLES
  const { len } = Array.from({ length: samples }, (_, i) => ((i + 1) / samples) * tEnd).reduce<{
    readonly len: number
    readonly prev: P
  }>(
    (acc, t) => {
      const pt = pointAt(start, seg, t)
      return { len: acc.len + distance(acc.prev, pt), prev: pt }
    },
    { len: 0, prev: start },
  )
  return len
}

/**
 * セグメント全体(`t=0` から `t=1` まで)の弧長を近似計算する。
 * 内部で {@link arcLengthTo} を `tEnd=1` で呼び出す。
 *
 * @param start - セグメントの始点
 * @param seg - ベジェセグメント
 * @param options - サンプリング精度
 */
export const segmentLength = <P extends Point>(
  start: P,
  seg: BezierSegment<P>,
  options: ArcLengthOptions = {},
): number => arcLengthTo(start, seg, 1, options)

/**
 * パスの各セグメントの始点を配列で返す。
 *
 * セグメント `i` の始点は、`i === 0` なら `path.start`、そうでなければ
 * `path.segments[i-1].end`。戻り値の長さは `path.segments.length`。
 *
 * @param path - 対象のパス
 */
export const segmentStartPoints = <P extends Point>(path: BezierPath<P>): readonly P[] => [
  path.start,
  ...path.segments.slice(0, -1).map((seg) => seg.end),
]
