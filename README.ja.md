# bezier-kit

依存ゼロの TypeScript 製 3 次ベジェ曲線ライブラリ。**2D / 3D 両対応**で、モーフィング・分割・弧長計算・パス生成を同じ API で扱える。

**[インタラクティブデモを見る → sumisonic.github.io/bezier-kit](https://sumisonic.github.io/bezier-kit/)**

- **`@sumisonic/bezier-kit-core`** — 幾何学操作(依存ゼロ、2D / 3D 両対応)
- **`@sumisonic/bezier-kit-style`** — 色・グラデーション・ストロークを伴うスタイル付きパス(core に依存、2D 限定)

## クイックスタート

> **Note**: npm にはまだ公開していません。現時点ではリポジトリを clone してローカルで利用してください(`pnpm install` → `pnpm build`)。`pnpm add` での導入は今後対応予定。

```ts
import { createPathInterpolator, fromCatmullRom, type Point2D } from '@sumisonic/bezier-kit-core'

// 2 形状のモーフィング
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

// 毎フレーム 0〜1 を行き来させる
requestAnimationFrame(function tick(t) {
  const phase = (Math.cos(t / 400) + 1) / 2
  const path = interp(phase)
  // path を Canvas 2D / SVG / three.js 等で描画
  requestAnimationFrame(tick)
})
```

3D に切り替えるには型パラメータを `Point3D` にするだけ:

```ts
import { fromCatmullRom, createPathInterpolator, type Point3D } from '@sumisonic/bezier-kit-core'

const a = fromCatmullRom<Point3D>([
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 1, z: 1 },
])
const interp = createPathInterpolator(a, b) // 引数・戻り値すべて Point3D
```

2D と 3D のパスを混ぜて渡すと**コンパイルエラー**になるので、次元の取り違えは型で防げる。

## 機能

- **モーフィング**: 2 つのパスを事前構築 1 回 + 毎フレーム呼び出し ~1μs で補間。Back / Elastic 系 easing で `t` が 0〜1 の範囲外になっても自然に動く
- **セグメント数の自動マッチング**: `from` と `to` のセグメント数が違っても補間できる(`matchSegmentCount` が弧長比例で均等化)
- **弧長比率でのパス上問い合わせ**: `pointAtLength(path, ratio)` / `tangentAtLength(path, ratio)` で座標と接線ベクトルを取得
- **弧長比率でのパス分割**: `createPathSplitter` で任意位置から 2 つに切り分け、分割後も補間・再分割が可能
- **点列からのパス生成**: `fromCatmullRom`(滑らかなスプライン)と `fromPolyline`(折れ線)
- **Frenet フレーム(3D、ホットパス向け)**: double-reflection 法で twist-free な (T, N, B) を `Float32Array` に直接書き込み。Tube / Ribbon 描画に使える
- **Catmull-Rom の Float32Array 直書き API**: 毎フレームの `BezierPath` 生成を回避し、alloc ゼロで制御点 → 幾何情報を変換
- **スタイル付きパスの補間**(`@sumisonic/bezier-kit-style`): 色・グラデーション・ストロークを含む 2D パスを同じ手順でアニメーション可能
- **型で 2D / 3D を区別**: 混在呼び出しはコンパイルエラー

## 主要 API

### core

```ts
import {
  // 型
  type Point2D,
  type Point3D,
  type BezierPath,
  type BezierSegment,
  type BBox2D,
  type BBox3D,

  // パスの操作
  createPathInterpolator,
  createPathInterpolatorStrict,
  createPathSplitter,
  matchSegmentCount,

  // 弧長比率での問い合わせ
  pointAtLength,
  tangentAtLength,

  // セグメントレベル
  pointAt,
  tangentAt,
  splitSegmentAt,
  arcLengthTo,
  segmentLength,

  // 弧長インデックス(大量呼び出しの高速化)
  createArcLengthIndex,
  arcLengthToParam,

  // バウンディングボックス
  bbox,

  // 点列からの生成
  fromCatmullRom,
  fromPolyline,

  // Functor(2D ↔ 3D 変換・平行移動など)
  mapPoints,

  // 数学ユーティリティ
  lerp,
  clamp,
  lerpPoint,
  distance,
} from '@sumisonic/bezier-kit-core'
```

#### モーフィング(事前構築 + 毎フレーム呼び出し)

```ts
const interp = createPathInterpolator(pathA, pathB)

// t = 0 で pathA、t = 1 で pathB、範囲外で外挿
const morphed = interp(t)
```

- **`t` は 0〜1 の範囲外も OK**(Back / Elastic 系 easing で `-0.2` や `1.2` になっても自然に動作)
- セグメント数が異なる場合は内部で自動マッチング

セグメント数の一致を強制したい場合は `createPathInterpolatorStrict`(不一致で `throw`)。

#### 弧長比率でパス上の点と接線を取る

```ts
const p = pointAtLength(path, 0.5) // パス上で弧長比率 50% の点
const v = tangentAtLength(path, 0.5) // 同じ位置の進行方向ベクトル

// 2D で角度が欲しい場合
const angle = Math.atan2(v.y, v.x)
```

- **`ratio` は内部で `clamp(0, 1)`** されるので範囲外でも安全
- 大量に呼ぶ場合は `createArcLengthIndex` + `arcLengthToParam` で事前計算すると高速

#### 弧長比率でのパス分割

```ts
const split = createPathSplitter(path)
const [left, right] = split(0.3) // 弧長で 30% / 70% に分ける
```

分割点は前半の `end` と後半の `start` で**完全に一致**する(De Casteljau 分割の性質)。

#### 2D → 3D 変換(`mapPoints`)

```ts
// 2D パスに z=0 を付加して 3D パスにする
const path3d = mapPoints<Point2D, Point3D>(path2d, (p) => ({ x: p.x, y: p.y, z: 0 }))

// 平行移動、スケール、回転など任意の点変換にも使える
const shifted = mapPoints<Point2D, Point2D>(path2d, (p) => ({ x: p.x + 10, y: p.y }))
```

#### Frenet フレーム(3D 限定、ホットパス向け)

3D パスに沿った twist-free な直交基底 `(T, N, B)` をサンプル点ごとに計算する。double-reflection 法で法線の捩れを最小化し、Tube geometry や Ribbon 描画に使える。

```ts
import {
  FRENET_STRIDE,
  FRENET_OFFSET,
  writeFrenetFrames,
  readFrenetFrame,
  computeFrenetFrames,
} from '@sumisonic/bezier-kit-core'

// デバッグ / 単発利用: オブジェクト配列を取得
const frames = computeFrenetFrames(path, samples)
frames[0].tangent // { x, y, z }、正規化済み
frames[0].normal // 同上、T と直交
frames[0].binormal // 同上、= T × N

// ホットパス: Float32Array に in-place 書き込み(alloc ゼロ)
const framesBuffer = new Float32Array(samples * FRENET_STRIDE)
writeFrenetFrames(framesBuffer, path, samples)

// バッファ直読み: stride + offset で任意成分にアクセス
const frameIdx = 5
const off = frameIdx * FRENET_STRIDE
const tx = framesBuffer[off + FRENET_OFFSET.TANGENT]
const ty = framesBuffer[off + FRENET_OFFSET.TANGENT + 1]
const tz = framesBuffer[off + FRENET_OFFSET.TANGENT + 2]
```

- **twist-free**: 隣接フレーム間の `N` の変化が最小(double-reflection 法)
- **alloc ゼロ**: `pointAt` / `tangentAt` を呼ばず、3 次ベジェ式を手展開で計算
- **精度制御**: `{ arcLengthSamples: 64 }` で弧長サンプル数を指定(既定 64)
- **`FRENET_STRIDE = 12`** と **`FRENET_OFFSET`**(POSITION=0, TANGENT=3, NORMAL=6, BINORMAL=9)はメジャーバージョン内 stable

#### Catmull-Rom の Float32Array 直書き API(ホットパス向け)

毎フレーム `fromCatmullRom` を呼ぶとパス 1 本につき数十個のオブジェクトが生成される。制御点が Float32Array で与えられる用途(WebAudio/WebXR/WASM 連携等)では、`BezierPath` オブジェクトを作らず直接セグメントの数値列を書き出す API を使える。

```ts
import {
  CATMULL_ROM_SEGMENT_STRIDE,
  CATMULL_ROM_SEGMENT_OFFSET,
  writeCatmullRomSegments,
  writeFrenetFramesFromCatmullRom,
} from '@sumisonic/bezier-kit-core'

// 20 制御点 → 19 セグメント(segment 1 個あたり 12 floats: start xyz, cp1 xyz, cp2 xyz, end xyz)
const controlPoints = new Float32Array(20 * 3) // [x0, y0, z0, x1, y1, z1, ...]
const segments = new Float32Array(19 * CATMULL_ROM_SEGMENT_STRIDE)
writeCatmullRomSegments(segments, controlPoints, 20)

// 制御点から直接 Frenet フレームへ(一体化 API、中間 segments バッファを隠蔽)
const samples = 101
const frames = new Float32Array(samples * FRENET_STRIDE)
writeFrenetFramesFromCatmullRom(frames, controlPoints, 20, samples)
```

- `CATMULL_ROM_SEGMENT_STRIDE = 12` / `CATMULL_ROM_SEGMENT_OFFSET` はメジャーバージョン内 stable
- 既存 `fromCatmullRom` と float32 精度で一致(1e-4 以内)

### style(2D 限定)

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

#### ストローク補間(`createStrokeLerp`)の仕様

片方しか存在しない値の扱いは以下のルール:

| 入力                            | 出力                                       |
| ------------------------------- | ------------------------------------------ |
| 両方 `undefined`                | 常に `undefined`                           |
| 片方だけ `stroke` あり          | 固定値(補間なし)                           |
| 両方にあり、両方 `width` あり   | `width` を線形補間                         |
| 片方だけ `width`                | 固定値                                     |
| 両方にあり、両方 `color` あり   | `color` を RGB 線形補間                    |
| 両方にあり、片方だけ `gradient` | `color` から仮グラデーションを合成して補間 |
| 両方 `gradient` あり            | `stop` 数を揃えて座標・色・offset を補間   |

## 描画例

本ライブラリは**描画エンジン非依存**。パスデータを返すだけで、描画は呼び出し側の責務。

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

// React なら <path d={d} stroke="currentColor" fill="none" />
```

### three.js(3D)

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

### インタラクティブデモ

本リポジトリの `examples/` にある:

- `canvas-morph` — Canvas 2D の 2D ランダム形状モーフィング + 分割
- `threejs-tube` — @react-three/fiber の 3D ランダムチューブモーフィング + 分割

```bash
pnpm example:canvas
pnpm example:three
```

## 型階層

```ts
type Point2D = { readonly x: number; readonly y: number }
type Point3D = { readonly x: number; readonly y: number; readonly z: number }
type Point = Point2D | Point3D

type BezierSegment<P extends Point> = { readonly cp1: P; readonly cp2: P; readonly end: P }
type BezierPath<P extends Point> = { readonly start: P; readonly segments: readonly BezierSegment<P>[] }

type BBox2D = { readonly minX; readonly minY; readonly width; readonly height }
type BBox3D = BBox2D & { readonly minZ; readonly depth }
type BBox<P extends Point> = P extends Point3D ? BBox3D : BBox2D // 入力次元に連動
```

`BezierPath<Point2D>` / `BezierPath<Point3D>` を**明示的に**書く(デフォルト型パラメータなし)。

## 対応していないこと

- 自己交差の検出 / boolean 演算(intersect / subtract 等)
- SVG path `d` 文字列のパース / 生成
- HSL / OKLCh 色補間(RGB 線形補間のみ)
- 2 次ベジェ / 楕円弧セグメント(3 次固定)
- 弧長の極値解析による厳密な bbox(現在の `bbox` は制御点凸包ベースの上界)
- 3D グラデーション / テクスチャ(style は 2D 限定)

## 他ライブラリとの棲み分け

- **[bezier-js](https://github.com/Pomax/bezierjs)**: 広範なベジェ幾何操作(offset、projection 等)。bezier-kit は動的モーフィング / 弧長経路問い合わせに特化 + 3D 対応
- **[paper.js](http://paperjs.org/)**: 描画・パス編集まで含む総合フレームワーク。bezier-kit はデータ層のみ
- **three.js の `CatmullRomCurve3`**: three.js 専用。bezier-kit は three.js 非依存で汎用的

## ライセンス

MIT © sumisonic

## 開発・コントリビュート

[CONTRIBUTING.md](./CONTRIBUTING.md) を参照。
