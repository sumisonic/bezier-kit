---
'@sumisonic/bezier-kit-core': minor
---

Arc-length → `t` inversion is now a table lookup, which completes the "precompute once, call cheaply" design.

- New: `createArcLengthParameterizer(path, options)` returns `{ index, locateParam }`. `index` is the same `ArcLengthIndex` as before; `locateParam(ratio)` returns `{ segmentIndex, t }` by looking up a per-segment cumulative arc-length table (`samples + 1` knots per segment, `Float64Array`) with two binary searches and a linear interpolation. No curve evaluation per call. New types `ArcLengthParam` and `ArcLengthParameterizer`.
- `createPathSplitter`, `pointAtLength` and `tangentAtLength` use that table internally instead of calling `arcLengthToParam` (15 bisection steps × 64 samples) on every call. `split(ratio)` went from ~50 µs to ~0.5 µs per call on a 19-segment path; the per-call sampling arrays and intermediate curve points are gone (what remains is the returned paths and small result objects).
- Results move slightly: the table inverts on the same 64-piece polyline that measured the segment lengths, so it is consistent with `createArcLengthIndex` and closer to a high-precision reference than the previous bisection (which re-measured with a different step on every iteration). Max |Δt| against a 4096-sample reference is ~1e-4 on smooth curves and ~2e-3 on tight loops / cusps.
- `createArcLengthIndex(...).lengths` are unchanged bit for bit (same formula and summation order). `locate` still returns a distance ratio, not `t`.
- `ratio = NaN` is treated as 0 (previously propagated as NaN). `samples` must be a positive integer (`RangeError` otherwise) for `arcLengthTo`, `segmentLength`, `createArcLengthIndex` and `createArcLengthParameterizer`. `scan` is O(N) (it copied the array on every step before).
- `arcLengthToParam` is kept as a one-off inversion without an index; its JSDoc now describes the step-size inconsistency of the bisection.
