import { bench, describe } from 'vitest'
import type { Point3D } from '../../src/types'
import { fromCatmullRom } from '../../src/path/from'
import {
  CATMULL_ROM_SEGMENT_STRIDE,
  writeCatmullRomSegments,
  writeFrenetFramesFromCatmullRom,
  writeFrenetFramesFromSegments,
} from '../../src/catmull-rom-hotpath'
import { FRENET_STRIDE, writeFrenetFrames } from '../../src/frenet'

/**
 * sumisonic.com の Ribbon と同等規模(20 制御点 → 19 セグメント、101 サンプル)。
 */
const POINT_COUNT = 20
const SEG_COUNT = POINT_COUNT - 1
const SAMPLES = 101

const pointsArray: readonly Point3D[] = Array.from({ length: POINT_COUNT }, (_, i) => ({
  x: i * 10,
  y: Math.sin(i * 0.4) * 40,
  z: Math.cos(i * 0.3) * 20,
}))

const controlPointsFloat32 = new Float32Array(POINT_COUNT * 3)
pointsArray.forEach((p, i) => {
  controlPointsFloat32[i * 3] = p.x
  controlPointsFloat32[i * 3 + 1] = p.y
  controlPointsFloat32[i * 3 + 2] = p.z
})

describe('writeCatmullRomSegments vs fromCatmullRom (allocation 比較)', () => {
  const segmentsBuffer = new Float32Array(SEG_COUNT * CATMULL_ROM_SEGMENT_STRIDE)

  bench('writeCatmullRomSegments (in-place)', () => {
    writeCatmullRomSegments(segmentsBuffer, controlPointsFloat32, POINT_COUNT)
  })

  bench('baseline: fromCatmullRom (既存、毎回 BezierPath 生成)', () => {
    fromCatmullRom<Point3D>(pointsArray)
  })
})

describe('writeFrenetFramesFromCatmullRom vs 2 段 (一体化 API の利得)', () => {
  const framesBuffer = new Float32Array(SAMPLES * FRENET_STRIDE)
  const segmentsBufferReuse = new Float32Array(SEG_COUNT * CATMULL_ROM_SEGMENT_STRIDE)

  bench('一体化 writeFrenetFramesFromCatmullRom (毎回 segments alloc)', () => {
    writeFrenetFramesFromCatmullRom(framesBuffer, controlPointsFloat32, POINT_COUNT, SAMPLES)
  })

  bench('2 段 + segments バッファ再利用', () => {
    // 一体化版と同じ仕事(segments → frames まで)を、segments バッファを使い回して行う。
    // 以前は Frenet 段を省いていたため 1 段 vs 2 段の比較になっていた(2026-09-20 修正)
    writeCatmullRomSegments(segmentsBufferReuse, controlPointsFloat32, POINT_COUNT)
    writeFrenetFramesFromSegments(framesBuffer, segmentsBufferReuse, SEG_COUNT, SAMPLES)
  })

  bench('baseline: fromCatmullRom + writeFrenetFrames', () => {
    const path = fromCatmullRom<Point3D>(pointsArray)
    writeFrenetFrames(framesBuffer, path, SAMPLES)
  })
})
