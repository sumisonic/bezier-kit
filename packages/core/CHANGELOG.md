# @sumisonic/bezier-kit-core

## 0.3.0

### Minor Changes

- [`0afa62f`](https://github.com/sumisonic/bezier-kit/commit/0afa62f04b191bbcfae04c310733cf6ea52db546) Thanks [@sumisonic](https://github.com/sumisonic)! - Arc-length → `t` inversion is now a table lookup, which completes the "precompute once, call cheaply" design.
  - New: `createArcLengthParameterizer(path, options)` returns `{ index, locateParam }`. `index` is the same `ArcLengthIndex` as before; `locateParam(ratio)` returns `{ segmentIndex, t }` by looking up a per-segment cumulative arc-length table (`samples + 1` knots per segment, `Float64Array`) with two binary searches and a linear interpolation. No curve evaluation per call. New types `ArcLengthParam` and `ArcLengthParameterizer`.
  - `createPathSplitter`, `pointAtLength` and `tangentAtLength` use that table internally instead of calling `arcLengthToParam` (15 bisection steps × 64 samples) on every call. `split(ratio)` went from ~50 µs to ~0.5 µs per call on a 19-segment path; the per-call sampling arrays and intermediate curve points are gone (what remains is the returned paths and small result objects).
  - Results move slightly: the table inverts on the same 64-piece polyline that measured the segment lengths, so it is consistent with `createArcLengthIndex` and closer to a high-precision reference than the previous bisection (which re-measured with a different step on every iteration). Max |Δt| against a 4096-sample reference is ~1e-4 on smooth curves and ~2e-3 on tight loops / cusps.
  - `createArcLengthIndex(...).lengths` are unchanged bit for bit (same formula and summation order). `locate` still returns a distance ratio, not `t`.
  - `ratio = NaN` is treated as 0 (previously propagated as NaN). `samples` must be a positive integer (`RangeError` otherwise) for `arcLengthTo`, `segmentLength`, `createArcLengthIndex` and `createArcLengthParameterizer`. `scan` is O(N) (it copied the array on every step before).
  - `arcLengthToParam` is kept as a one-off inversion without an index; its JSDoc now describes the step-size inconsistency of the bisection.

- [`46bec55`](https://github.com/sumisonic/bezier-kit/commit/46bec55e1f6bf5500e9a4a5fd33a3713a2864ce9) Thanks [@sumisonic](https://github.com/sumisonic)! - New `createRotationMinimizingFrameWriter`: a factory that allocates its scratch buffers once and returns `writePath` / `writeSegments`, which write `(position, tangent, normal, binormal)` frames into a caller-owned `Float32Array` with **no allocation per call** (measured on V8 with `pnpm bench:alloc`: 0 young-generation GCs over 100k calls, with and without `--no-turbo-inlining`; the pre-0.3.0 writer allocated ~400 KB per call).
  - Normals are transported with the **double-reflection method** (Wang et al. 2008), fourth-order accurate on smooth, regular curves. The old writer used the minimal rotation between adjacent tangents (second-order). With the same initial normal, the end-of-curve error on a helix drops by 4–5×.
  - Samples are placed by **arc length** by default (`parameterization: 'arc-length'`, same per-segment table as `createPathSplitter`); `'segment-t'` reproduces the old spacing (uniform `t` within a segment).
  - `initialNormal` lets a caller carry the previous frame's normal across frames of a moving curve, avoiding flips when the automatic axis choice changes.
  - Degenerate input (zero-length path, zero tangents, coincident samples, initial normal parallel to the tangent) falls back to a deterministic orthonormal basis by default; `strict: true` throws. Capacity (`maxSegments`), buffer lengths and finiteness are validated on every call (`RangeError`).
  - New exports: `RMF_STRIDE` / `RMF_OFFSET` (same values as `FRENET_STRIDE` / `FRENET_OFFSET`), `readRotationMinimizingFrame`, `computeRotationMinimizingFrames`, types `RotationMinimizingFrame`, `RotationMinimizingFrameWriter`, `RotationMinimizingFrameWriterOptions`, `FrameParameterization`.
  - `writeCatmullRomSegments` no longer allocates per call (loop instead of `Array.from().forEach`; `options` is now an optional parameter instead of a `{}` default).
  - **Deprecated, unchanged**: `writeFrenetFrames`, `computeFrenetFrames`, `writeFrenetFramesFromSegments`, `writeFrenetFramesFromCatmullRom` keep their pre-0.3.0 output (and their per-call allocation). The name "Frenet" was a misnomer: these frames were never Frenet–Serret frames (whose normal points along curvature); both old and new compute rotation-minimizing frames.
  - Hot-path files (`rmf.ts`, `catmull-rom-hotpath.ts`) are allowed to use `for` / `let` (ESLint override with the rationale in the file header).

### Patch Changes

- [`6820d6a`](https://github.com/sumisonic/bezier-kit/commit/6820d6a7d0c690c0613f1a9fec1a82631ed7e9bd) Thanks [@sumisonic](https://github.com/sumisonic)! - Documentation and benchmark accuracy fixes (no behavior change).
  - README / JSDoc no longer claim "zero allocation" for the hot-path writers: `writeFrenetFrames` / `writeFrenetFramesFromSegments` still allocate internally on every call (arrays, reduce accumulators, control-point tuples, and a temporary `BezierPath`-shaped object graph in the segments variant). They write in place into a caller-owned buffer, which is what was true.
  - The frame computation is described as what it is: normals are carried by the minimal rotation between adjacent tangents (a second-order discrete rotation-minimizing frame, the same approach as three.js), not the double-reflection method. Within a segment, samples are spaced by uniform `t`; `arcLengthSamples` only affects how samples are distributed across segments.
  - `createPathSplitter` documents that the arc-length → `t` inversion (`arcLengthToParam`, 15 iterations × 64 samples by default) still runs on every call; only the per-segment lengths are precomputed.
  - `arcLengthTo`, `arcLengthToParam`, `scan` and `writeCatmullRomSegments` JSDoc corrected ("tEnd × samples" → always `samples`; step-size inconsistency of the bisection; `scan` is O(N²) via spread; float32 agreement instead of "bit-exact").
  - Benchmarks: the "2-stage with buffer reuse" case now runs the Frenet stage too (it previously compared one stage against two), and labels no longer say "0-alloc". A test that claimed to check bit-exact arc lengths now checks the actual contract (segment chosen by arc length, uniform `t` within the segment).

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
