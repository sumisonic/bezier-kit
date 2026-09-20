---
'@sumisonic/bezier-kit-core': patch
---

Documentation and benchmark accuracy fixes (no behavior change).

- README / JSDoc no longer claim "zero allocation" for the hot-path writers: `writeFrenetFrames` / `writeFrenetFramesFromSegments` still allocate internally on every call (arrays, reduce accumulators, control-point tuples, and a temporary `BezierPath`-shaped object graph in the segments variant). They write in place into a caller-owned buffer, which is what was true.
- The frame computation is described as what it is: normals are carried by the minimal rotation between adjacent tangents (a second-order discrete rotation-minimizing frame, the same approach as three.js), not the double-reflection method. Within a segment, samples are spaced by uniform `t`; `arcLengthSamples` only affects how samples are distributed across segments.
- `createPathSplitter` documents that the arc-length → `t` inversion (`arcLengthToParam`, 15 iterations × 64 samples by default) still runs on every call; only the per-segment lengths are precomputed.
- `arcLengthTo`, `arcLengthToParam`, `scan` and `writeCatmullRomSegments` JSDoc corrected ("tEnd × samples" → always `samples`; step-size inconsistency of the bisection; `scan` is O(N²) via spread; float32 agreement instead of "bit-exact").
- Benchmarks: the "2-stage with buffer reuse" case now runs the Frenet stage too (it previously compared one stage against two), and labels no longer say "0-alloc". A test that claimed to check bit-exact arc lengths now checks the actual contract (segment chosen by arc length, uniform `t` within the segment).
