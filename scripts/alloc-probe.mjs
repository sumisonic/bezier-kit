#!/usr/bin/env node
/**
 * hot-path API の割り当てを Scavenge(young generation の GC)の回数で測る。
 *
 * heapUsed の差分は JIT が生成するコードや OSR のデータまで拾って KB 単位では信用できないため、
 * `--max-semi-space-size=1` にして、warm-up 後に N 回呼んだ間の Scavenge 回数を数える(回帰検知用)。
 * 「0 回」は「N 回の呼び出しの間に young generation の GC を起こすだけの割り当てが無かった」という意味で、
 * 回数から bytes/call は換算しない(young generation は semi-space 指定値の約 3 倍で、survivor や初期占有量もあるため)。
 *
 * 使い方(先に `pnpm build`):
 *   pnpm bench:alloc                 # 既定と --no-turbo-inlining の両方で走る
 *   node scripts/alloc-probe.mjs --case writer --n 100000
 *
 * 2026-09-20 の結果(Node 22.14、20 制御点 → 19 セグメント、101 サンプル):
 *   writer.writeSegments / writePath: 100k 回で 0 回(既定・--no-turbo-inlining とも)
 *   writeCatmullRomSegments: 100k 回で 0 回(`for` に書き換える前の `Array.from().forEach` 版は 53 回)
 *   legacy writeFrenetFramesFromSegments: 5k 回で 1,869 回
 *   ⚠ Math.hypot は V8 で呼び出しごとに割り当てる(3 引数の 24M 回で 2,831 回の Scavenge)。kernel では使わない
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(here, '../packages/core/dist/index.js')
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}

// 子プロセス側(--worker)の本体
if (args.includes('--worker')) {
  const M = await import(dist)
  const which = arg('case', 'writer')
  const N = Number(arg('n', '100000'))
  const pts = Array.from({ length: 20 }, (_, i) => ({
    x: i * 10,
    y: Math.sin(i * 0.4) * 40,
    z: Math.cos(i * 0.3) * 20,
  }))
  const cps = new Float32Array(pts.flatMap((p) => [p.x, p.y, p.z]))
  const segs = new Float32Array(19 * 12)
  M.writeCatmullRomSegments(segs, cps, 20)
  const path3d = M.fromCatmullRom(pts)
  const out = new Float32Array(101 * 12)
  const n0 = new Float32Array([0, 0, 1])
  const w = M.createRotationMinimizingFrameWriter({ maxSegments: 19, samples: 101 })
  const cases = {
    noop: () => {},
    writer: () => w.writeSegments(out, segs, 19, n0),
    writerPath: () => w.writePath(out, path3d, n0),
    legacy: () => M.writeFrenetFramesFromSegments(out, segs, 19, 101),
    catmullRom: () => M.writeCatmullRomSegments(segs, cps, 20),
  }
  const fn = cases[which]
  if (!fn) throw new Error(`unknown case: ${which} (${Object.keys(cases).join(', ')})`)
  for (let i = 0; i < 2000; i++) fn()
  globalThis.gc()
  // --trace-gc は stdout に出るので、区切りも stdout に出して順序を保つ
  console.log('__START__')
  for (let i = 0; i < N; i++) fn()
  console.log('__END__')
} else {
  const which = arg('case', null)
  const N = arg('n', null)
  const cases = which ? [which] : ['noop', 'writer', 'writerPath', 'catmullRom', 'legacy']
  const flagsets = [[], ['--no-turbo-inlining']]
  console.log('case          flags                 calls    scavenges')
  cases.forEach((c) => {
    flagsets.forEach((flags) => {
      const n = N ?? (c === 'legacy' ? '5000' : '100000')
      const r = spawnSync(
        process.execPath,
        [
          '--expose-gc',
          '--trace-gc',
          '--max-semi-space-size=1',
          ...flags,
          fileURLToPath(import.meta.url),
          '--worker',
          '--case',
          c,
          '--n',
          n,
        ],
        { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
      )
      if (r.error !== undefined || r.status !== 0) {
        throw new Error(
          `alloc-probe: worker failed for ${c} ${flags.join(' ')} (status ${String(r.status)}):\n${r.stderr}`,
        )
      }
      if (!r.stdout.includes('__START__') || !r.stdout.includes('__END__')) {
        throw new Error(
          `alloc-probe: worker output for ${c} has no markers (dist missing? run pnpm build):\n${r.stderr}`,
        )
      }
      const body = r.stdout.split('__START__')[1]?.split('__END__')[0] ?? ''
      const count = (body.match(/Scavenge/g) ?? []).length
      console.log(
        `${c.padEnd(13)} ${(flags[0] ?? 'default').padEnd(21)} ${n.padStart(7)} ${String(count).padStart(10)}`,
      )
    })
  })
}
