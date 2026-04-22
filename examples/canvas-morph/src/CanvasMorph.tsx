import { useEffect, useMemo, useRef } from 'react'
import type { BezierPath, BezierSegment, Point2D } from '@sumisonic/bezier-kit-core'
import { createPathInterpolator, createPathSplitter } from '@sumisonic/bezier-kit-core'

const WIDTH = 760
const HEIGHT = 400
const MARGIN = 60

const randomBetween = (min: number, max: number): number => Math.random() * (max - min) + min

const randomPoint = (xMin: number, xMax: number, yMin: number, yMax: number): Point2D => ({
  x: randomBetween(xMin, xMax),
  y: randomBetween(yMin, yMax),
})

/**
 * ランダムな 3 次ベジェパスを生成する。
 * セグメント数は 3〜8 個。X 方向は左から右へ進み、Y と制御点はランダム。
 */
const generateRandomPath = (): BezierPath<Point2D> => {
  const segmentCount = Math.floor(randomBetween(3, 9))
  const xRange = WIDTH - MARGIN * 2
  const segWidth = xRange / segmentCount

  const start = randomPoint(MARGIN, MARGIN + segWidth * 0.2, MARGIN, HEIGHT - MARGIN)

  const segments: readonly BezierSegment<Point2D>[] = Array.from({ length: segmentCount }, (_, i) => {
    const xBase = MARGIN + segWidth * i
    return {
      cp1: randomPoint(xBase, xBase + segWidth * 0.5, MARGIN, HEIGHT - MARGIN),
      cp2: randomPoint(xBase + segWidth * 0.5, xBase + segWidth, MARGIN, HEIGHT - MARGIN),
      end: randomPoint(xBase + segWidth * 0.7, xBase + segWidth * 1.2, MARGIN, HEIGHT - MARGIN),
    }
  })

  return { start, segments }
}

type DrawStyle = {
  readonly color: string
  readonly lineWidth: number
  readonly alpha?: number
}

const drawPath = (ctx: CanvasRenderingContext2D, path: BezierPath<Point2D>, style: DrawStyle): void => {
  ctx.save()
  ctx.globalAlpha = style.alpha ?? 1
  ctx.strokeStyle = style.color
  ctx.lineWidth = style.lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(path.start.x, path.start.y)
  path.segments.forEach((seg) => {
    ctx.bezierCurveTo(seg.cp1.x, seg.cp1.y, seg.cp2.x, seg.cp2.y, seg.end.x, seg.end.y)
  })
  ctx.stroke()
  ctx.restore()
}

/**
 * BezierPath<Point2D> の全ての点(`start` と各セグメントの `cp1` / `cp2` / `end`)を
 * 指定したベクトルだけ平行移動する。
 */
const translatePath = (path: BezierPath<Point2D>, dx: number, dy: number): BezierPath<Point2D> => ({
  start: { x: path.start.x + dx, y: path.start.y + dy },
  segments: path.segments.map((seg) => ({
    cp1: { x: seg.cp1.x + dx, y: seg.cp1.y + dy },
    cp2: { x: seg.cp2.x + dx, y: seg.cp2.y + dy },
    end: { x: seg.end.x + dx, y: seg.end.y + dy },
  })),
})

// 分割後の左右を離す方向。分割点の接線から法線を取ると、ratio がセグメント境界を
// またいだ瞬間に参照セグメントが変わって方向が急変するため、ここでは固定ベクトルを使う。
const SPLIT_OFFSET_DIR: Point2D = { x: 0, y: 1 }

type Props = {
  readonly animating: boolean
  readonly speed: number
  readonly manualT: number
  readonly seed: number
  readonly splitRatio: number
  readonly splitOffset: number
  readonly showSplit: boolean
  readonly showEndpoints: boolean
}

export const CanvasMorph = ({
  animating,
  speed,
  manualT,
  seed,
  splitRatio,
  splitOffset,
  showSplit,
  showEndpoints,
}: Props): React.ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // seed が変わったら 2 形状を再生成
  const { pathFrom, pathTo, interp } = useMemo(() => {
    void seed
    const from = generateRandomPath()
    const to = generateRandomPath()
    return { pathFrom: from, pathTo: to, interp: createPathInterpolator(from, to) }
  }, [seed])

  const animatingRef = useRef(animating)
  const speedRef = useRef(speed)
  const manualTRef = useRef(manualT)
  const splitRatioRef = useRef(splitRatio)
  const splitOffsetRef = useRef(splitOffset)
  const showSplitRef = useRef(showSplit)
  const showEndpointsRef = useRef(showEndpoints)
  useEffect(() => {
    animatingRef.current = animating
  }, [animating])
  useEffect(() => {
    speedRef.current = speed
  }, [speed])
  useEffect(() => {
    manualTRef.current = manualT
  }, [manualT])
  useEffect(() => {
    splitRatioRef.current = splitRatio
  }, [splitRatio])
  useEffect(() => {
    splitOffsetRef.current = splitOffset
  }, [splitOffset])
  useEffect(() => {
    showSplitRef.current = showSplit
  }, [showSplit])
  useEffect(() => {
    showEndpointsRef.current = showEndpoints
  }, [showEndpoints])

  const phaseRef = useRef(0)
  const lastRenderRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    lastRenderRef.current = performance.now()

    const render = (now: number): void => {
      const dt = (now - lastRenderRef.current) / 1000
      lastRenderRef.current = now

      // アニメ ON: phase を進めて cos で 0〜1 往復。OFF: 手動 t を使う
      if (animatingRef.current) {
        phaseRef.current += dt * speedRef.current
      }
      const t = animatingRef.current ? (Math.cos(phaseRef.current) + 1) / 2 : manualTRef.current

      ctx.clearRect(0, 0, WIDTH, HEIGHT)

      // 背景に from / to を半透明で描画
      drawPath(ctx, pathFrom, { color: '#4ecdc4', lineWidth: 2, alpha: 0.25 })
      drawPath(ctx, pathTo, { color: '#f9a826', lineWidth: 2, alpha: 0.25 })

      // 補間後のパス
      const current = interp(t)

      if (showSplitRef.current) {
        const split = createPathSplitter(current)
        const [left, right] = split(splitRatioRef.current)

        // 分割後半を固定方向にオフセットさせて物理的に離す
        const offset = splitOffsetRef.current
        const dx = SPLIT_OFFSET_DIR.x * offset * 0.5
        const dy = SPLIT_OFFSET_DIR.y * offset * 0.5
        const leftShifted = offset > 0 ? translatePath(left, -dx, -dy) : left
        const rightShifted = offset > 0 ? translatePath(right, dx, dy) : right

        drawPath(ctx, leftShifted, { color: '#e94560', lineWidth: 3.5 })
        drawPath(ctx, rightShifted, { color: '#5bc0be', lineWidth: 3.5 })

        if (showEndpointsRef.current) {
          const leftEnd = leftShifted.segments[leftShifted.segments.length - 1]?.end
          const rightStart = rightShifted.start
          // 両端それぞれにドットを打つ(オフセット 0 のときは重なる)
          const drawDot = (p: Point2D, color: string): void => {
            ctx.save()
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#111421'
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.restore()
          }
          if (leftEnd) drawDot(leftEnd, '#ffcccc')
          drawDot(rightStart, '#ccffee')
        }
      } else {
        drawPath(ctx, current, { color: '#e94560', lineWidth: 3.5 })
      }

      raf = requestAnimationFrame(render)
    }

    raf = requestAnimationFrame(render)
    return (): void => cancelAnimationFrame(raf)
  }, [interp, pathFrom, pathTo])

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{
        width: '100%',
        maxWidth: WIDTH,
        aspectRatio: `${WIDTH} / ${HEIGHT}`,
        background: '#141821',
        borderRadius: 12,
      }}
    />
  )
}
