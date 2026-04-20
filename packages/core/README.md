# @sumisonic/bezier-kit-core

Zero-dependency TypeScript cubic-bezier library (geometry layer). **Works with both 2D and 3D**.

See the [repository README](https://github.com/sumisonic/bezier-kit#readme) for full usage, type hierarchy, non-goals, rendering examples, and comparisons with other libraries.

## Installation

```bash
pnpm add @sumisonic/bezier-kit-core
```

## Minimal example (2D)

```ts
import { createPathInterpolator, fromCatmullRom, type Point2D } from '@sumisonic/bezier-kit-core'

const a = fromCatmullRom<Point2D>([
  { x: 0, y: 0 },
  { x: 100, y: 50 },
  { x: 200, y: 0 },
])
const b = fromCatmullRom<Point2D>([
  { x: 0, y: 0 },
  { x: 100, y: -50 },
  { x: 200, y: 0 },
])

const interp = createPathInterpolator(a, b)
const morphed = interp(0.5) // BezierPath<Point2D>
```

Switching to 3D is just changing the type parameter to `Point3D` (mixing 2D and 3D is a compile-time error).

## Features

- Path-level: `createPathInterpolator` / `createPathInterpolatorStrict` / `createPathSplitter` / `matchSegmentCount`
- Arc-length queries: `pointAtLength` / `tangentAtLength`
- Segment-level: `pointAt` / `tangentAt` / `splitSegmentAt` / `arcLengthTo` / `segmentLength`
- Arc-length index: `createArcLengthIndex` / `arcLengthToParam`
- Bounding box: `bbox` (returns `BBox2D` or `BBox3D` depending on input)
- Construction from points: `fromCatmullRom` / `fromPolyline`
- Functor: `mapPoints` (2D ↔ 3D conversion, translation, scale, etc.)
- Math utilities: `lerp` / `clamp` / `lerpPoint` / `distance` / `scan` / `binarySearchIndex`
- Types: `Point2D` / `Point3D` / `Point`, `BezierSegment<P>`, `BezierPath<P>`, `BBox2D` / `BBox3D` / `BBox<P>`, `ArcLengthIndex<P>`, `ArcLengthLocation`

See the [repository README](https://github.com/sumisonic/bezier-kit#readme) for API details.

## License

MIT © sumisonic
