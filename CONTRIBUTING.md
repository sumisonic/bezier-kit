# Contributing to bezier-kit

開発・コントリビュート向けのドキュメント。利用者向けの情報は [README.md](./README.md) を参照。

## セットアップ

```bash
pnpm install
```

Node.js 20 以上、pnpm 10 以上を推奨。

## 開発コマンド

```bash
pnpm check        # ESLint + TypeScript 型チェック + Prettier format チェック
pnpm lint         # ESLint のみ
pnpm type-check   # tsc --noEmit
pnpm format       # Prettier で自動整形
pnpm format:check # Prettier チェックのみ
pnpm test:run     # Vitest(型テスト含む)
pnpm bench        # ベンチマーク(vitest bench)
pnpm build        # 両パッケージをビルド
```

examples:

```bash
pnpm example:canvas   # Canvas 2D デモ(http://localhost:5173)
pnpm example:three    # three.js 3D デモ(http://localhost:5174)
```

## コーディング規約

- **フォーマット**: Prettier(シングルクォート、セミコロンなし、printWidth 120)
- **関数型スタイル**: 以下を `eslint-plugin-functional` で強制
  - `const` のみ。`let` は使わない(式で導出: 三項演算子、即時関数、`reduce` 等)
  - ループは `map` / `forEach` / `reduce` / `flatMap` / `Array.from`。`for` / `while` は使わない
  - 引数の再代入 (mutation) をしない
- **型**: 全て `readonly`。型エイリアス(`type`)を `interface` より優先
- **未使用変数**: `_` プレフィックスで抑制
- **テスト**: `*.spec.ts`(ランタイム)、`*.spec-d.ts`(型)、`*.bench.ts`(ベンチマーク)
- **JSDoc**: 全ての公開関数・型に日本語 JSDoc を付ける

## API 設計原則

### ファクトリパターン

事前計算が重い処理は `create*(...)` が関数を返す形にする:

```ts
const interp = createPathInterpolator(pathA, pathB) // 事前計算(重め)
const morphed = interp(t) // 毎フレーム(軽い)
```

毎フレームの呼び出しコストを最小化し、構築時にクロージャで状態を閉じ込める。

### 2D / 3D のジェネリクス

- `<P extends Point>` を API に貫通
- デフォルト型パラメータは付けない(`BezierPath<Point2D>` / `BezierPath<Point3D>` を明示)
- 2D / 3D の混在は**型エラー**で弾く(`Point2D` / `Point3D` の `__dim` ファントムフィールドで構造的非互換)
- style パッケージは `<P extends Point2D = Point2D>` で 2D 限定

### 命名規約

- **`*At(t)`**: ベジェパラメータ `t`(0〜1、**範囲外は外挿**可)
- **`*AtLength(ratio)`**: 弧長比率(0〜1、**範囲外は内部で clamp**)
- 関数名から `Bezier` プレフィックスは落とす(型名は `BezierSegment` / `BezierPath` のまま)

### エラー処理

- 不正入力(NaN、空配列、形式不正の hex 等)は `throw Error`(fail-fast 方針)
- 範囲外値の扱い:
  - 補間系(`lerp`, `pointAt`, `createPathInterpolator` 等): 素通し(外挿可、Back/Elastic easing 対応)
  - 弧長系(`pointAtLength`, `createPathSplitter` 等): 内部で `clamp(0, 1)`

## ワークフロー

- **Git 運用**: `main` + `feature/*`
- 作業開始前に `feature/<名前>` ブランチを worktree で作成し、そこに移動する
- `.claude/docs/sow/feature-<名前>.md` に SOW(Statement of Work)を作成し、承認を得てから実装に着手する
- 作業中に方針が変わった場合はコード変更と合わせて SOW も更新する
- コミット前に `pnpm check` と `pnpm test:run` を実行

詳細は [.claude/CLAUDE.md](./.claude/CLAUDE.md) を参照。

## リリース(Changesets)

```bash
pnpm changeset         # 変更内容を対話で記録 → .changeset/*.md が生成される
pnpm run version       # .changeset/*.md からバージョンと CHANGELOG を更新
pnpm run release       # build + npm publish(要 NPM_TOKEN)
```

## プロジェクト構成

```
bezier-kit/
├── packages/
│   ├── core/        # 幾何学層(依存ゼロ、2D / 3D 両対応)
│   └── style/       # スタイル層(core に依存、2D 限定)
├── examples/
│   ├── canvas-morph/    # React + Canvas 2D デモ
│   └── threejs-tube/    # React + three.js (3D) デモ
├── .changeset/     # Changesets 設定とリリースノート
└── .claude/        # 開発メモ・SOW
```

## ライセンス

MIT
