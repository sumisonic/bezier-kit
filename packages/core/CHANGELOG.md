# @sumisonic/bezier-kit-core

## 0.2.0

### Minor Changes

- [`4ad6856`](https://github.com/sumisonic/bezier-kit/commit/4ad685640fa1257620cf631df7021bcc60ca3ac4) Thanks [@sumisonic](https://github.com/sumisonic)! - Add hot-path Frenet and Catmull-Rom APIs for allocation-free 3D geometry.

  ### New public API
  - **Frenet frames** (3D):
    - `writeFrenetFrames(out, path, samples, options?)` — in-place double-reflection frames to `Float32Array`
    - `readFrenetFrame(frames, frameIdx)` — read as `FrenetFrame { position, tangent, normal, binormal }: Point3D`
    - `computeFrenetFrames(path, samples, options?)` — convenience wrapper
    - `FRENET_STRIDE = 12` / `FRENET_OFFSET` constants, stable within major version
  - **Catmull-Rom Float32Array writers** (3D):
    - `writeCatmullRomSegments(out, controlPoints, pointCount, options?)` — flat xyz → 12 floats/segment
    - `writeFrenetFramesFromSegments(out, segments, segCount, samples, options?)`
    - `writeFrenetFramesFromCatmullRom(out, controlPoints, pointCount, samples, options?)` — one-shot wrapper
    - `CATMULL_ROM_SEGMENT_STRIDE = 12` / `CATMULL_ROM_SEGMENT_OFFSET` constants, stable within major version

  ### No breaking changes

  All existing APIs (`arcLengthToParam`, `createArcLengthIndex`, `pointAtLength`, `tangentAtLength`, `fromCatmullRom`, etc.) are unchanged in signature and behavior.

  ### Performance (micro-benchmark, 20 segments × 101 samples, 3D)
  - `writeFrenetFrames` vs `createArcLengthIndex + pointAt + tangentAt` loop: **~50x faster**
  - `writeFrenetFramesFromCatmullRom` with segments buffer reuse: **~80x faster** than `fromCatmullRom + writeFrenetFrames` per frame

  ### Numerical agreement
  - `writeCatmullRomSegments` matches `fromCatmullRom` at float32 precision (within 1e-4)
  - `writeFrenetFrames` is orthonormal (|T| = |N| = |B| = 1, T·N ≈ N·B ≈ T·B ≈ 0 within 1e-5)

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
