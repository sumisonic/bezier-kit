---
'@sumisonic/bezier-kit-core': minor
---

Add hot-path Frenet and Catmull-Rom APIs for allocation-free 3D geometry.

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
