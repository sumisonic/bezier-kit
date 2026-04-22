import type { BezierPath, Point3D } from './types'
import type { CatmullRomOptions } from './path/from'
import type { FrenetOptions } from './frenet'
import { FRENET_OFFSET, FRENET_STRIDE, writeFrenetFrames } from './frenet'

/**
 * Float32Array に格納する 1 セグメントあたりの float 数。
 *
 * レイアウト: `[startX, startY, startZ, cp1X, cp1Y, cp1Z, cp2X, cp2Y, cp2Z, endX, endY, endZ]`
 *
 * 各セグメントが self-contained(始点を重複保持)。隣接セグメントの `start` と
 * 前セグメントの `end` は同値だが、個別アクセス時の計算簡素化のため冗長に持つ。
 *
 * メジャーバージョン内は stable。
 */
export const CATMULL_ROM_SEGMENT_STRIDE = 12

/**
 * Float32Array 内の各制御点のオフセット(stride 内の index)。
 */
export const CATMULL_ROM_SEGMENT_OFFSET = {
  START: 0,
  CP1: 3,
  CP2: 6,
  END: 9,
} as const

/**
 * 制御点 `Float32Array` から必要なセグメント数を計算する。
 *
 * @param pointCount 制御点数(= `controlPoints.length / 3`)
 * @returns セグメント数(= `pointCount - 1`)
 */
export const catmullRomSegmentCount = (pointCount: number): number => {
  if (pointCount < 2) throw new Error(`catmullRomSegmentCount: pointCount must be >= 2 (got ${pointCount})`)
  return pointCount - 1
}

/**
 * Catmull-Rom 制御点(flat xyz)から 3 次ベジェセグメントの数値列を `Float32Array` に
 * 書き込む。中間の `BezierPath` オブジェクトを一切生成しない(alloc 0)。
 *
 * 既存 {@link import('./path/from').fromCatmullRom | fromCatmullRom} と同じ数式を使うため、
 * 制御点が `Point3D` 配列の場合と bit-exact な数値が得られる。
 *
 * ## レイアウト(入出力)
 * - `controlPoints`: `[x0, y0, z0, x1, y1, z1, ...]`、長さ `pointCount * 3`
 * - `out`: 各セグメント `CATMULL_ROM_SEGMENT_STRIDE (= 12)` floats、長さ `(pointCount - 1) * 12`
 *   レイアウトは {@link CATMULL_ROM_SEGMENT_OFFSET}
 *
 * @param out 出力バッファ(長さ ≥ `(pointCount - 1) * 12`)
 * @param controlPoints 制御点 flat xyz(長さ `pointCount * 3`)
 * @param pointCount 制御点数(≥ 2)
 * @param options テンション等のオプション
 * @throws `pointCount < 2` の場合
 */
export const writeCatmullRomSegments = (
  out: Float32Array,
  controlPoints: Float32Array,
  pointCount: number,
  options: CatmullRomOptions = {},
): void => {
  if (pointCount < 2) throw new Error(`writeCatmullRomSegments: pointCount must be >= 2 (got ${pointCount})`)

  const tension = options.tension ?? 1

  // fromCatmullRom と同じ extended 配列の index 計算を Float32Array 上で直接行う
  // extended[0] = points[0], extended[1..pointCount] = points[0..pointCount-1], extended[pointCount+1] = points[pointCount-1]
  //
  // セグメント i は extended[i+1] → extended[i+2] の変換で、
  //   prev = extended[i]
  //   current = extended[i+1]
  //   next = extended[i+2]
  //   nextNext = extended[i+3] (存在しなければ next)
  //
  // Float32Array 上では:
  //   extended[k] = (k === 0) ? points[0] : (k === pointCount + 1) ? points[pointCount - 1] : points[k - 1]

  const segCount = pointCount - 1
  const lastIndex = pointCount - 1
  // extended[k] を Float32Array index に変換するヘルパ(clamp ロジックをベタに展開)
  // k=0 → 0、k=pointCount+1 → lastIndex、その他 → k-1。全て 0..lastIndex の範囲に収まる。
  const extendedIndex = (k: number): number => (k <= 0 ? 0 : k >= pointCount + 1 ? lastIndex : k - 1)

  Array.from({ length: segCount }, (_, i) => i).forEach((i) => {
    const prevBase = extendedIndex(i) * 3
    const currentBase = extendedIndex(i + 1) * 3
    const nextBase = extendedIndex(i + 2) * 3
    const nextNextBase = extendedIndex(i + 3) * 3

    const prevX = controlPoints[prevBase]!
    const prevY = controlPoints[prevBase + 1]!
    const prevZ = controlPoints[prevBase + 2]!
    const currentX = controlPoints[currentBase]!
    const currentY = controlPoints[currentBase + 1]!
    const currentZ = controlPoints[currentBase + 2]!
    const nextX = controlPoints[nextBase]!
    const nextY = controlPoints[nextBase + 1]!
    const nextZ = controlPoints[nextBase + 2]!
    const nextNextX = controlPoints[nextNextBase]!
    const nextNextY = controlPoints[nextNextBase + 1]!
    const nextNextZ = controlPoints[nextNextBase + 2]!

    const cp1X = currentX + ((nextX - prevX) / 6) * tension
    const cp1Y = currentY + ((nextY - prevY) / 6) * tension
    const cp1Z = currentZ + ((nextZ - prevZ) / 6) * tension
    const cp2X = nextX - ((nextNextX - currentX) / 6) * tension
    const cp2Y = nextY - ((nextNextY - currentY) / 6) * tension
    const cp2Z = nextZ - ((nextNextZ - currentZ) / 6) * tension

    const off = i * CATMULL_ROM_SEGMENT_STRIDE
    out[off + CATMULL_ROM_SEGMENT_OFFSET.START] = currentX
    out[off + CATMULL_ROM_SEGMENT_OFFSET.START + 1] = currentY
    out[off + CATMULL_ROM_SEGMENT_OFFSET.START + 2] = currentZ
    out[off + CATMULL_ROM_SEGMENT_OFFSET.CP1] = cp1X
    out[off + CATMULL_ROM_SEGMENT_OFFSET.CP1 + 1] = cp1Y
    out[off + CATMULL_ROM_SEGMENT_OFFSET.CP1 + 2] = cp1Z
    out[off + CATMULL_ROM_SEGMENT_OFFSET.CP2] = cp2X
    out[off + CATMULL_ROM_SEGMENT_OFFSET.CP2 + 1] = cp2Y
    out[off + CATMULL_ROM_SEGMENT_OFFSET.CP2 + 2] = cp2Z
    out[off + CATMULL_ROM_SEGMENT_OFFSET.END] = nextX
    out[off + CATMULL_ROM_SEGMENT_OFFSET.END + 1] = nextY
    out[off + CATMULL_ROM_SEGMENT_OFFSET.END + 2] = nextZ
  })
}

/**
 * `writeCatmullRomSegments` の出力レイアウトを `BezierPath<Point3D>` に変換する。
 *
 * Frenet API は `BezierPath<Point3D>` を受け取る既存 API を流用するため、この
 * ヘルパで軽量な object 構造を作って渡す。Float32Array の view なので数値コピーは
 * しないが、object wrapper は 1 + segCount 個生成する。
 *
 * より高速な「segments Float32Array を直接受け取る Frenet」は
 * {@link writeFrenetFramesFromSegments} を参照(こちらは完全に alloc-free)。
 */
const viewSegmentsAsPath = (segments: Float32Array, segCount: number): BezierPath<Point3D> => {
  const readPoint = (base: number): Point3D => ({
    x: segments[base]!,
    y: segments[base + 1]!,
    z: segments[base + 2]!,
  })
  // start は seg 0 の START
  const start = readPoint(CATMULL_ROM_SEGMENT_OFFSET.START)
  const segs = Array.from({ length: segCount }, (_, i) => {
    const off = i * CATMULL_ROM_SEGMENT_STRIDE
    return {
      cp1: readPoint(off + CATMULL_ROM_SEGMENT_OFFSET.CP1),
      cp2: readPoint(off + CATMULL_ROM_SEGMENT_OFFSET.CP2),
      end: readPoint(off + CATMULL_ROM_SEGMENT_OFFSET.END),
    }
  })
  return { start, segments: segs }
}

/**
 * {@link writeCatmullRomSegments} で書き出した `Float32Array` から Frenet フレームを計算する。
 *
 * ## 現状の実装と今後の最適化
 * 実装は `viewSegmentsAsPath` で `BezierPath<Point3D>` view を作り
 * {@link writeFrenetFrames} に委譲する。view は `1 + segCount` 個のオブジェクトを生成するが、
 * 数値コピーは一切発生しない。完全 alloc-free にするには Frenet 側を
 * `BezierPath` ベースではなく Float32Array ベースで再実装する必要があり、今後の
 * 最適化余地として残す(本 SOW のスコープ外)。
 *
 * なお、制御点から直接呼ぶ場合は {@link writeFrenetFramesFromCatmullRom} を使うと
 * segments Float32Array を中間で確保せず済み、合計の alloc も減らせる。
 *
 * @param out Frenet フレーム出力バッファ(長さ `samples * FRENET_STRIDE`)
 * @param segments {@link writeCatmullRomSegments} の出力
 * @param segCount セグメント数(= `pointCount - 1`)
 * @param samples サンプル点数(≥ 2)
 * @param options 精度オプション
 */
export const writeFrenetFramesFromSegments = (
  out: Float32Array,
  segments: Float32Array,
  segCount: number,
  samples: number,
  options: FrenetOptions = {},
): void => {
  const path = viewSegmentsAsPath(segments, segCount)
  writeFrenetFrames(out, path, samples, options)
}

/**
 * Catmull-Rom 制御点から直接 Frenet フレームを計算する便利薄ラッパ。
 *
 * 内部で一時 segments バッファ((`pointCount - 1`) * 12 floats)を確保し、
 * {@link writeCatmullRomSegments} + {@link writeFrenetFramesFromSegments} を順に呼ぶ。
 *
 * ホットパスで呼ぶ場合、毎フレーム segments バッファを新規確保するとやや無駄があるため、
 * 呼び出し元で segments バッファを `useRef` 等で保持しつつ上記 2 段 API を使うのが最良。
 * 本関数は利便性優先の一体化 API で、コード量を減らしたい用途向け。
 *
 * @param out Frenet フレーム出力バッファ(長さ `samples * FRENET_STRIDE`)
 * @param controlPoints 制御点 flat xyz(長さ `pointCount * 3`)
 * @param pointCount 制御点数(≥ 2)
 * @param samples サンプル点数(≥ 2)
 * @param options Catmull-Rom + Frenet のオプション
 */
export const writeFrenetFramesFromCatmullRom = (
  out: Float32Array,
  controlPoints: Float32Array,
  pointCount: number,
  samples: number,
  options: CatmullRomOptions & FrenetOptions = {},
): void => {
  const segCount = catmullRomSegmentCount(pointCount)
  const segments = new Float32Array(segCount * CATMULL_ROM_SEGMENT_STRIDE)
  writeCatmullRomSegments(segments, controlPoints, pointCount, options)
  writeFrenetFramesFromSegments(out, segments, segCount, samples, options)
}

/** 再 export: {@link FRENET_OFFSET} / {@link FRENET_STRIDE} と併用する想定 */
export { FRENET_OFFSET, FRENET_STRIDE }
