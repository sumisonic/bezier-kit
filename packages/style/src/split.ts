import type { BBox2D, BezierPath, Point2D } from '@sumisonic/bezier-kit-core'
import { bbox as computeBBox, createPathSplitter } from '@sumisonic/bezier-kit-core'
import { remapGradient } from './gradient'
import type { StrokeStyle, StyledBezierPath } from './types'

/**
 * ストロークのグラデーション座標を新しいパスの bbox に再マッピングする。
 * グラデーションがない場合はそのまま返す。
 *
 * @param stroke - 元のストロークスタイル
 * @param origBBox - 元パスの bbox
 * @param newPath - 座標変換先のパス(2D)
 */
const remapStroke = <P extends Point2D>(
  stroke: StrokeStyle | undefined,
  origBBox: BBox2D,
  newPath: BezierPath<P>,
): StrokeStyle | undefined => {
  if (!stroke?.gradient) return stroke
  const newBBox = computeBBox(newPath)
  return { ...stroke, gradient: remapGradient(stroke.gradient, origBBox, newBBox) }
}

/**
 * {@link StyledBezierPath} を弧長比率で分割する関数を返す。
 *
 * グラデーション座標は元パスの bbox を基準に分割後の bbox へ変換されるため、
 * 分割前後で見た目のグラデーションが維持される。
 *
 * `ratio` は内部で `clamp(0, 1)` される({@link createPathSplitter} に委譲)。
 *
 * 型パラメータ `P` は `Point2D` の派生に制約される(2D 限定)。
 *
 * @param styled - 分割対象の {@link StyledBezierPath}
 * @returns `ratio` を受け取り `[前半, 後半]` を返す関数
 */
export const createStyledPathSplitter = <P extends Point2D = Point2D>(
  styled: StyledBezierPath<P>,
): ((ratio: number) => readonly [StyledBezierPath<P>, StyledBezierPath<P>]) => {
  const splitFn = createPathSplitter(styled.path)
  const origBBox = styled.stroke?.gradient ? computeBBox(styled.path) : undefined

  return (ratio: number): readonly [StyledBezierPath<P>, StyledBezierPath<P>] => {
    const [left, right] = splitFn(ratio)
    const leftStroke = origBBox ? remapStroke(styled.stroke, origBBox, left) : styled.stroke
    const rightStroke = origBBox ? remapStroke(styled.stroke, origBBox, right) : styled.stroke
    return [
      {
        path: left,
        ...(leftStroke !== undefined && { stroke: leftStroke }),
      },
      {
        path: right,
        ...(rightStroke !== undefined && { stroke: rightStroke }),
      },
    ]
  }
}
