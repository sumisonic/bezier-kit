import { bench, describe } from 'vitest'
import type { BezierPath, Point3D } from '../../src/types'
import { fromCatmullRom } from '../../src/path/from'
import { FRENET_STRIDE, writeFrenetFrames } from '../../src/frenet'
import { createArcLengthIndex } from '../../src/arc-length'
import { arcLengthToParam } from '../../src/arc-length-param'
import { pointAt, tangentAt } from '../../src/segment'

/**
 * 20 セグメントの現実的な 3D パス(Catmull-Rom 由来)。
 * sumisonic.com の Ribbon と同じ規模(20 制御点 → 19 セグメント)。
 */
const path3D: BezierPath<Point3D> = fromCatmullRom<Point3D>(
  Array.from({ length: 20 }, (_, i) => ({
    x: i * 10,
    y: Math.sin(i * 0.4) * 40,
    z: Math.cos(i * 0.3) * 20,
  })),
)

const SAMPLES = 101

describe('writeFrenetFrames vs pointAt+tangentAt ループ (3D, 101 samples)', () => {
  const out = new Float32Array(SAMPLES * FRENET_STRIDE)

  bench('writeFrenetFrames (new, 0-alloc)', () => {
    writeFrenetFrames(out, path3D, SAMPLES)
  })

  bench('baseline: createArcLengthIndex + pointAt+tangentAt ループ', () => {
    const index = createArcLengthIndex(path3D)
    const startPoints = index.startPoints
    Array.from({ length: SAMPLES }, (_, i) => {
      const ratio = i / (SAMPLES - 1)
      const loc = index.locate(ratio)
      const seg = path3D.segments[loc.segmentIndex]!
      const sp = startPoints[loc.segmentIndex]!
      const segLen = index.lengths[loc.segmentIndex] ?? 0
      const t = arcLengthToParam(sp, seg, loc.localRatio, segLen)
      const p = pointAt(sp, seg, t)
      const v = tangentAt(sp, seg, t)
      return { p, v }
    })
  })
})
