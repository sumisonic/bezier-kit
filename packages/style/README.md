# @sumisonic/bezier-kit-style

Style-aware bezier path interpolation and splitting (color, gradient, stroke). **2D only**. Depends on `@sumisonic/bezier-kit-core`.

See the [repository README](https://github.com/sumisonic/bezier-kit#readme) for full usage, the `createStrokeLerp` behavior table, and comparisons with other libraries.

## Installation

```bash
pnpm add @sumisonic/bezier-kit-core @sumisonic/bezier-kit-style
```

## Minimal example

```ts
import type { Point2D } from '@sumisonic/bezier-kit-core'
import { createStyledPathInterpolator } from '@sumisonic/bezier-kit-style'

const interp = createStyledPathInterpolator<Point2D>(
  { path: pathA, stroke: { width: 2, color: '#ff0000' } },
  { path: pathB, stroke: { width: 6, color: '#0000ff' } },
)

const morphed = interp(0.5) // StyledBezierPath<Point2D>
```

Passing a `BezierPath<Point3D>` is a compile-time error. 3D stroke materials / textures belong in the rendering layer (e.g. three.js).

## Features

- Color: `parseHexColor` (`#rrggbb` only) / `toHexColor` / `lerpColor` / `createColorLerp`
- Gradient: `gradientToAbsolute` / `remapGradient`
- Styled morphing: `createStyledPathInterpolator` / `createStrokeLerp`
- Styled splitting: `createStyledPathSplitter` (remaps gradient coordinates to the split bbox)
- Path-count matching: `matchStyledPathCount`
- Types: `StyledBezierPath<P extends Point2D>`, `StrokeStyle`, `LinearGradient`, `GradientStop`, `ViewBox`, `StyledBezierData<P>`

See the [repository README](https://github.com/sumisonic/bezier-kit#readme) for API details.

## License

MIT © sumisonic
