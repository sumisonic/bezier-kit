# bezier-kit

[日本語 README](./README.ja.md)

A zero-dependency TypeScript library for cubic bezier curves. **Works with both 2D and 3D** through the same API — morphing, splitting, arc-length queries, and path generation.

**[View interactive demos → sumisonic.github.io/bezier-kit](https://sumisonic.github.io/bezier-kit/)**

- **`@sumisonic/bezier-kit-core`** — geometric operations (zero dependency, 2D / 3D)
- **`@sumisonic/bezier-kit-style`** — style-aware paths with colors, gradients, and strokes (depends on core, 2D only)

## Install

```bash
pnpm add @sumisonic/bezier-kit-core
# Add the style layer too if you need it:
pnpm add @sumisonic/bezier-kit-style
```

Also works with `npm install` / `yarn add`.

## Quick Start

```ts
import { createPathInterpolator, fromCatmullRom, type Point2D } from '@sumisonic/bezier-kit-core'

// Morph between two shapes
const pathA = fromCatmullRom<Point2D>([
  { x: 0, y: 0 },
  { x: 100, y: 50 },
  { x: 200, y: 0 },
])
const pathB = fromCatmullRom<Point2D>([
  { x: 0, y: 0 },
  { x: 100, y: -50 },
  { x: 200, y: 0 },
])

const interp = createPathInterpolator(pathA, pathB)

// Oscillate 0..1 every frame
requestAnimationFrame(function tick(t) {
  const phase = (Math.cos(t / 400) + 1) / 2
  const path = interp(phase)
  // Draw `path` with Canvas 2D / SVG / three.js, etc.
  requestAnimationFrame(tick)
})
```

Switching to 3D is just changing the type parameter to `Point3D`:

```ts
import { fromCatmullRom, createPathInterpolator, type Point3D } from '@sumisonic/bezier-kit-core'

const a = fromCatmullRom<Point3D>([
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 1, z: 1 },
])
const interp = createPathInterpolator(a, b) // All arguments and return values are Point3D
```

Mixing 2D and 3D paths produces a **compile-time error**, so dimension mistakes are caught by the type system.

## Features

- **Morphing**: Interpolate between two paths with a single-time setup, then a ~1μs per-frame call. `t` values outside 0–1 work naturally for back/elastic easing
- **Automatic segment matching**: When `from` and `to` have different segment counts, `matchSegmentCount` equalizes them proportionally by arc length
- **Arc-length queries**: Get point and tangent vector at any arc-length ratio via `pointAtLength(path, ratio)` / `tangentAtLength(path, ratio)`
- **Arc-length splits**: Slice a path at any ratio with `createPathSplitter`; sub-paths can be further interpolated or split
- **Path generation from points**: `fromCatmullRom` (smooth spline) and `fromPolyline` (straight segments)
- **Styled paths** (`@sumisonic/bezier-kit-style`): animate 2D paths with color, gradient, and stroke using the same patterns
- **Dimension-safe at type level**: Mixing 2D and 3D calls is a compile-time error

## Main API

### core

```ts
import {
  // Types
  type Point2D,
  type Point3D,
  type BezierPath,
  type BezierSegment,
  type BBox2D,
  type BBox3D,

  // Path-level
  createPathInterpolator,
  createPathInterpolatorStrict,
  createPathSplitter,
  matchSegmentCount,

  // Arc-length queries
  pointAtLength,
  tangentAtLength,

  // Segment-level
  pointAt,
  tangentAt,
  splitSegmentAt,
  arcLengthTo,
  segmentLength,

  // Arc-length index (fast for many calls)
  createArcLengthIndex,
  arcLengthToParam,

  // Bounding box
  bbox,

  // Construction from points
  fromCatmullRom,
  fromPolyline,

  // Functor (2D ↔ 3D conversion, translation, etc.)
  mapPoints,

  // Math utilities
  lerp,
  clamp,
  lerpPoint,
  distance,
} from '@sumisonic/bezier-kit-core'
```

#### Morphing (prepare once, call per frame)

```ts
const interp = createPathInterpolator(pathA, pathB)

// t = 0 returns pathA, t = 1 returns pathB; extrapolates outside [0, 1]
const morphed = interp(t)
```

- **`t` can be outside 0–1** — useful for back/elastic easings that dip to `-0.2` or `1.2`
- When segment counts differ, they are matched automatically

Use `createPathInterpolatorStrict` if you want an error instead of automatic matching.

#### Point and tangent at arc-length ratio

```ts
const p = pointAtLength(path, 0.5) // Point on path at 50% arc length
const v = tangentAtLength(path, 0.5) // Tangent (direction) at the same position

// For 2D angles:
const angle = Math.atan2(v.y, v.x)
```

- **`ratio` is internally clamped to [0, 1]**, so out-of-range values are safe
- For many calls, build once with `createArcLengthIndex` and reuse `arcLengthToParam` for speed

#### Splitting by arc-length ratio

```ts
const split = createPathSplitter(path)
const [left, right] = split(0.3) // 30% / 70% split by arc length
```

The split point is **exactly shared** between the end of `left` and the start of `right` (De Casteljau splits are precise).

#### 2D → 3D conversion via `mapPoints`

```ts
// Promote a 2D path to 3D with z = 0
const path3d = mapPoints<Point2D, Point3D>(path2d, (p) => ({ x: p.x, y: p.y, z: 0 }))

// Or use it for any per-point transform (translation, scale, rotation, etc.)
const shifted = mapPoints<Point2D, Point2D>(path2d, (p) => ({ x: p.x + 10, y: p.y }))
```

### style (2D only)

```ts
import {
  createStyledPathInterpolator,
  createStyledPathSplitter,
  matchStyledPathCount,
  createStrokeLerp,
  gradientToAbsolute,
  remapGradient,
  parseHexColor,
  toHexColor,
  lerpColor,
  createColorLerp,
  type StyledBezierPath,
  type StrokeStyle,
  type LinearGradient,
  type GradientStop,
  type ViewBox,
  type StyledBezierData,
} from '@sumisonic/bezier-kit-style'
```

#### `createStrokeLerp` behavior

How each input combination is handled:

| Input                        | Output                                                                |
| ---------------------------- | --------------------------------------------------------------------- |
| Both `undefined`             | Always `undefined`                                                    |
| Only one side has `stroke`   | Static value (no interpolation)                                       |
| Both have `width`            | `width` is linearly interpolated                                      |
| Only one side has `width`    | Static value                                                          |
| Both have `color`            | `color` is RGB-linearly interpolated                                  |
| Only one side has `gradient` | Synthesized gradient from `color`, then interpolated                  |
| Both have `gradient`         | Stop counts matched, then coordinates / colors / offsets interpolated |

## Rendering

This library is **renderer-agnostic** — it returns path data, and you handle drawing.

### Canvas 2D

```ts
const ctx = canvas.getContext('2d')
ctx.beginPath()
ctx.moveTo(path.start.x, path.start.y)
for (const seg of path.segments) {
  ctx.bezierCurveTo(seg.cp1.x, seg.cp1.y, seg.cp2.x, seg.cp2.y, seg.end.x, seg.end.y)
}
ctx.stroke()
```

### SVG

```ts
const d =
  `M ${path.start.x} ${path.start.y} ` +
  path.segments.map((s) => `C ${s.cp1.x} ${s.cp1.y}, ${s.cp2.x} ${s.cp2.y}, ${s.end.x} ${s.end.y}`).join(' ')

// In React: <path d={d} stroke="currentColor" fill="none" />
```

### three.js (3D)

```ts
import * as THREE from 'three'
import { fromCatmullRom, pointAtLength, type Point3D } from '@sumisonic/bezier-kit-core'

const path = fromCatmullRom<Point3D>([
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 1, z: 1 },
  { x: 2, y: 0, z: 2 },
])

const samples = 96
const points = Array.from({ length: samples }, (_, i) => {
  const p = pointAtLength(path, i / (samples - 1))
  return new THREE.Vector3(p.x, p.y, p.z)
})

const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5)
const geometry = new THREE.TubeGeometry(curve, 96, 0.1, 16, false)
```

### Interactive demos

Check `examples/` in this repository:

- `canvas-morph` — 2D random-shape morphing + split (React + Canvas 2D)
- `threejs-tube` — 3D random-tube morphing + split (React + @react-three/fiber)

```bash
pnpm example:canvas
pnpm example:three
```

## Type hierarchy

```ts
type Point2D = { readonly x: number; readonly y: number }
type Point3D = { readonly x: number; readonly y: number; readonly z: number }
type Point = Point2D | Point3D

type BezierSegment<P extends Point> = { readonly cp1: P; readonly cp2: P; readonly end: P }
type BezierPath<P extends Point> = { readonly start: P; readonly segments: readonly BezierSegment<P>[] }

type BBox2D = { readonly minX; readonly minY; readonly width; readonly height }
type BBox3D = BBox2D & { readonly minZ; readonly depth }
type BBox<P extends Point> = P extends Point3D ? BBox3D : BBox2D // tracks input dimension
```

Write `BezierPath<Point2D>` / `BezierPath<Point3D>` **explicitly** (no default type parameter).

## Non-goals

- Self-intersection detection / boolean ops (intersect, subtract, etc.)
- SVG path `d` string parsing / serialization
- HSL / OKLCh color interpolation (RGB only)
- Quadratic bezier or elliptical arc segments (cubic only)
- Exact bbox via extremum analysis (current `bbox` is a convex-hull upper bound)
- 3D gradients / textures (style is 2D only)

## Comparison

- **[bezier-js](https://github.com/Pomax/bezierjs)**: Broad set of bezier operations (offset, projection, etc.). bezier-kit focuses on dynamic morphing and arc-length queries, plus 3D support
- **[paper.js](http://paperjs.org/)**: Full framework including rendering and editing. bezier-kit is data-layer only
- **three.js `CatmullRomCurve3`**: three.js-specific. bezier-kit is renderer-agnostic and works the same way in 2D and 3D

## License

MIT © [sumisonic](https://github.com/sumisonic)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
