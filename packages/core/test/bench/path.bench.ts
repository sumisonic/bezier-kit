import { bench, describe } from 'vitest'
import type { BezierPath, Point2D, Point3D } from '../../src/types'
import { createArcLengthIndex } from '../../src/arc-length'
import { createPathInterpolator } from '../../src/path/interpolate'
import { createPathSplitter } from '../../src/path/split'
import { pointAtLength, tangentAtLength } from '../../src/path-query'
import { fromCatmullRom } from '../../src/path/from'

/**
 * 20 セグメントの現実的なパス(Catmull-Rom 由来、2D)。
 */
const pathA: BezierPath<Point2D> = fromCatmullRom<Point2D>(
  Array.from({ length: 21 }, (_, i) => ({ x: i * 10, y: Math.sin(i * 0.4) * 40 })),
)

const pathB: BezierPath<Point2D> = fromCatmullRom<Point2D>(
  Array.from({ length: 21 }, (_, i) => ({ x: i * 10, y: Math.cos(i * 0.4) * 40 })),
)

/** 同じ形状の 3D 版(z を sin で追加) */
const pathA3D: BezierPath<Point3D> = fromCatmullRom<Point3D>(
  Array.from({ length: 21 }, (_, i) => ({ x: i * 10, y: Math.sin(i * 0.4) * 40, z: Math.cos(i * 0.3) * 20 })),
)

const pathB3D: BezierPath<Point3D> = fromCatmullRom<Point3D>(
  Array.from({ length: 21 }, (_, i) => ({ x: i * 10, y: Math.cos(i * 0.4) * 40, z: Math.sin(i * 0.3) * 20 })),
)

describe('createArcLengthIndex', () => {
  bench('construct (2D, 20 segments)', () => {
    createArcLengthIndex(pathA)
  })

  bench('construct (3D, 20 segments)', () => {
    createArcLengthIndex(pathA3D)
  })
})

describe('createPathInterpolator (2D)', () => {
  const interp = createPathInterpolator(pathA, pathB)

  bench('construct', () => {
    createPathInterpolator(pathA, pathB)
  })

  bench('run @ t=0.5', () => {
    interp(0.5)
  })
})

describe('createPathInterpolator (3D)', () => {
  const interp = createPathInterpolator(pathA3D, pathB3D)

  bench('construct', () => {
    createPathInterpolator(pathA3D, pathB3D)
  })

  bench('run @ t=0.5', () => {
    interp(0.5)
  })
})

describe('createPathSplitter', () => {
  const splitter = createPathSplitter(pathA)

  bench('construct (2D)', () => {
    createPathSplitter(pathA)
  })

  bench('run @ ratio=0.5 (2D)', () => {
    splitter(0.5)
  })
})

describe('pointAtLength / tangentAtLength (single-shot)', () => {
  bench('pointAtLength @ ratio=0.3 (2D)', () => {
    pointAtLength(pathA, 0.3)
  })

  bench('tangentAtLength @ ratio=0.3 (2D)', () => {
    tangentAtLength(pathA, 0.3)
  })

  bench('pointAtLength @ ratio=0.3 (3D)', () => {
    pointAtLength(pathA3D, 0.3)
  })

  bench('tangentAtLength @ ratio=0.3 (3D)', () => {
    tangentAtLength(pathA3D, 0.3)
  })
})
