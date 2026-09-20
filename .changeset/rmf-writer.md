---
'@sumisonic/bezier-kit-core': minor
---

New `createRotationMinimizingFrameWriter`: a factory that allocates its scratch buffers once and returns `writePath` / `writeSegments`, which write `(position, tangent, normal, binormal)` frames into a caller-owned `Float32Array` with **no allocation per call** (measured on V8 with `pnpm bench:alloc`: 0 young-generation GCs over 100k calls, with and without `--no-turbo-inlining`; the pre-0.3.0 writer allocated ~400 KB per call).

- Normals are transported with the **double-reflection method** (Wang et al. 2008), fourth-order accurate on smooth, regular curves. The old writer used the minimal rotation between adjacent tangents (second-order). With the same initial normal, the end-of-curve error on a helix drops by 4–5×.
- Samples are placed by **arc length** by default (`parameterization: 'arc-length'`, same per-segment table as `createPathSplitter`); `'segment-t'` reproduces the old spacing (uniform `t` within a segment).
- `initialNormal` lets a caller carry the previous frame's normal across frames of a moving curve, avoiding flips when the automatic axis choice changes.
- Degenerate input (zero-length path, zero tangents, coincident samples, initial normal parallel to the tangent) falls back to a deterministic orthonormal basis by default; `strict: true` throws. Capacity (`maxSegments`), buffer lengths and finiteness are validated on every call (`RangeError`).
- New exports: `RMF_STRIDE` / `RMF_OFFSET` (same values as `FRENET_STRIDE` / `FRENET_OFFSET`), `readRotationMinimizingFrame`, `computeRotationMinimizingFrames`, types `RotationMinimizingFrame`, `RotationMinimizingFrameWriter`, `RotationMinimizingFrameWriterOptions`, `FrameParameterization`.
- `writeCatmullRomSegments` no longer allocates per call (loop instead of `Array.from().forEach`; `options` is now an optional parameter instead of a `{}` default).
- **Deprecated, unchanged**: `writeFrenetFrames`, `computeFrenetFrames`, `writeFrenetFramesFromSegments`, `writeFrenetFramesFromCatmullRom` keep their pre-0.3.0 output (and their per-call allocation). The name "Frenet" was a misnomer: these frames were never Frenet–Serret frames (whose normal points along curvature); both old and new compute rotation-minimizing frames.
- Hot-path files (`rmf.ts`, `catmull-rom-hotpath.ts`) are allowed to use `for` / `let` (ESLint override with the rationale in the file header).
