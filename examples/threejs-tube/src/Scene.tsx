import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { BezierPath, Point3D } from '@sumisonic/bezier-kit-core'
import {
  createPathInterpolator,
  createPathSplitter,
  fromCatmullRom,
  pointAtLength,
  tangentAt,
} from '@sumisonic/bezier-kit-core'

const SAMPLES = 96
const TUBE_RADIUS = 0.1
const RADIAL_SEGMENTS = 16

const randomBetween = (min: number, max: number): number => Math.random() * (max - min) + min

/**
 * ランダムな 3D 通過点列から `BezierPath<Point3D>` を直接生成する。
 * X は左→右、Y / Z がランダム。
 */
const generateRandomPath = (): BezierPath<Point3D> => {
  const pointCount = Math.floor(randomBetween(8, 16))
  const points: Point3D[] = Array.from({ length: pointCount }, (_, i) => ({
    x: (i / (pointCount - 1) - 0.5) * 8,
    y: randomBetween(-1.4, 1.4),
    z: randomBetween(-1.4, 1.4),
  }))
  return fromCatmullRom<Point3D>(points)
}

/**
 * 3D BezierPath から TubeGeometry 用の Vector3 サンプル列を生成する。
 * `pointAtLength` は 3D パスに対してそのまま 3D 点を返す。
 */
const sampleAsVector3 = (path: BezierPath<Point3D>, samples: number): readonly THREE.Vector3[] =>
  Array.from({ length: samples }, (_, i) => {
    const ratio = i / (samples - 1)
    const p = pointAtLength(path, ratio)
    return new THREE.Vector3(p.x, p.y, p.z)
  })

/**
 * Vector3 列から TubeGeometry を組み立てる。
 * 2 点以下の場合は最小限の退化 curve を返す(crash 回避)。
 */
const buildTubeGeometry = (points: readonly THREE.Vector3[]): THREE.TubeGeometry => {
  if (points.length < 2) {
    const fallback = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0.01, 0, 0)])
    return new THREE.TubeGeometry(fallback, 2, TUBE_RADIUS, RADIAL_SEGMENTS, false)
  }
  const curve = new THREE.CatmullRomCurve3([...points], false, 'catmullrom', 0.5)
  return new THREE.TubeGeometry(curve, Math.max(points.length * 2, 64), TUBE_RADIUS, RADIAL_SEGMENTS, false)
}

type Props = {
  readonly animating: boolean
  readonly speed: number
  readonly manualT: number
  readonly seed: number
  readonly splitRatio: number
  readonly splitOffset: number
  readonly showSplit: boolean
}

export const MorphingTube = ({
  animating,
  speed,
  manualT,
  seed,
  splitRatio,
  splitOffset,
  showSplit,
}: Props): React.ReactElement => {
  const leftMeshRef = useRef<THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial> | null>(null)
  const rightMeshRef = useRef<THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial> | null>(null)
  const fullMeshRef = useRef<THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial> | null>(null)

  const interp = useMemo(() => {
    void seed
    const a = generateRandomPath()
    const b = generateRandomPath()
    return createPathInterpolator(a, b)
  }, [seed])

  useEffect(() => {
    return (): void => {
      leftMeshRef.current?.geometry.dispose()
      rightMeshRef.current?.geometry.dispose()
      fullMeshRef.current?.geometry.dispose()
    }
  }, [])

  const animatingRef = useRef(animating)
  const speedRef = useRef(speed)
  const manualTRef = useRef(manualT)
  const splitRatioRef = useRef(splitRatio)
  const splitOffsetRef = useRef(splitOffset)
  const showSplitRef = useRef(showSplit)
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

  // アニメーション非再生中でも経過時間を保持するための相対 clock。
  const phaseRef = useRef(0)
  const lastElapsedRef = useRef(0)

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    const dt = now - lastElapsedRef.current
    lastElapsedRef.current = now
    if (animatingRef.current) {
      phaseRef.current += dt * 0.8 * speedRef.current
    }
    const t = animatingRef.current ? (Math.cos(phaseRef.current) + 1) / 2 : manualTRef.current
    const path = interp(t)

    if (showSplitRef.current) {
      const split = createPathSplitter(path)
      const [leftPath, rightPath] = split(splitRatioRef.current)

      const leftPts = sampleAsVector3(leftPath, Math.max(16, Math.floor(SAMPLES * splitRatioRef.current)))
      const rightPts = sampleAsVector3(rightPath, Math.max(16, Math.floor(SAMPLES * (1 - splitRatioRef.current))))

      // 分割点(右パスの始点)での 3D 接線を法線方向に変換してオフセット方向を決める。
      // 3D では XY 平面の法線を取るため、接線の z 成分は使わない(簡易実装)。
      const firstSeg = rightPath.segments[0]
      const tan = firstSeg ? tangentAt(rightPath.start, firstSeg, 0) : { x: 1, y: 0, z: 0 }
      const tanLen = Math.hypot(tan.x, tan.y)
      const nx = tanLen > 1e-9 ? -tan.y / tanLen : 0
      const ny = tanLen > 1e-9 ? tan.x / tanLen : 1
      const offset = splitOffsetRef.current
      const leftOffsetX = -nx * offset * 0.5
      const leftOffsetY = -ny * offset * 0.5
      const rightOffsetX = nx * offset * 0.5
      const rightOffsetY = ny * offset * 0.5

      if (leftMeshRef.current) {
        leftMeshRef.current.geometry.dispose()
        leftMeshRef.current.geometry = buildTubeGeometry(leftPts)
        leftMeshRef.current.position.set(leftOffsetX, leftOffsetY, 0)
        leftMeshRef.current.visible = true
      }
      if (rightMeshRef.current) {
        rightMeshRef.current.geometry.dispose()
        rightMeshRef.current.geometry = buildTubeGeometry(rightPts)
        rightMeshRef.current.position.set(rightOffsetX, rightOffsetY, 0)
        rightMeshRef.current.visible = true
      }
      if (fullMeshRef.current) fullMeshRef.current.visible = false
    } else {
      const pts = sampleAsVector3(path, SAMPLES)
      if (fullMeshRef.current) {
        fullMeshRef.current.geometry.dispose()
        fullMeshRef.current.geometry = buildTubeGeometry(pts)
        fullMeshRef.current.visible = true
      }
      if (leftMeshRef.current) leftMeshRef.current.visible = false
      if (rightMeshRef.current) rightMeshRef.current.visible = false
    }
  })

  return (
    <group>
      <mesh ref={fullMeshRef}>
        <meshStandardMaterial color="#66d9ef" roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh ref={leftMeshRef}>
        <meshStandardMaterial color="#e94560" roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh ref={rightMeshRef}>
        <meshStandardMaterial color="#5bc0be" roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  )
}
