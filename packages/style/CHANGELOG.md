# @sumisonic/bezier-kit-style

## 0.1.0

### Minor Changes

- [`f575c3f`](https://github.com/sumisonic/bezier-kit/commit/f575c3fc64e23380672c6acbd6ddcfd38ab02e87) Thanks [@sumisonic](https://github.com/sumisonic)! - Initial release of `bezier-kit`.
  - `@sumisonic/bezier-kit-core`: zero-dependency cubic-bezier geometry layer
    with **2D / 3D support** via a `<P extends Point>` generic that is
    propagated through every API (`BezierSegment<P>`, `BezierPath<P>`,
    `BBox<P>`, etc.). Includes: types, math utilities, bbox (`BBox2D` /
    `BBox3D` via conditional type), segment / path operations (split,
    interpolate, match-count), arc-length index (O(N) scan + O(log N)
    binary search), Catmull-Rom / polyline constructors, `pointAtLength` /
    `tangentAtLength`, and the functor `mapPoints` (2D ↔ 3D conversion,
    translation, scale, etc.).
  - `@sumisonic/bezier-kit-style`: style-aware morphing and splitting, built
    on top of core and **constrained to 2D** (`<P extends Point2D>`).
    Includes hex color validation + interpolation, linear-gradient remap,
    stroke / styled-path interpolator and splitter, styled-path count matcher.
  - ESM + CJS dual publish with `.d.ts` / `.d.cts` and `sideEffects: false`
    for tree-shaking.
  - Merges and generalizes the bezier / bezier-utils modules from the
    `arte-web` project and the `@sumisonic/find-point-on-path` library,
    removing fp-ts and Effect Schema dependencies.

### Patch Changes

- Updated dependencies [[`f575c3f`](https://github.com/sumisonic/bezier-kit/commit/f575c3fc64e23380672c6acbd6ddcfd38ab02e87)]:
  - @sumisonic/bezier-kit-core@0.1.0
