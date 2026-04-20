# Changesets

このディレクトリは [Changesets](https://github.com/changesets/changesets) がリリースの変更履歴を管理するために使用する。

## 使い方

新しい変更を加えたら以下を実行し、対話でパッケージとバージョン種別 (major / minor / patch) を選択する。

```bash
pnpm changeset
```

`.changeset/*.md` が生成されるので、それを commit する。

リリース時には以下でバージョンと `CHANGELOG.md` を自動更新し、`changeset publish` で npm に公開する(公開は要 `NPM_TOKEN`)。

```bash
pnpm run version   # バージョン更新 + CHANGELOG 生成
pnpm run release   # build + npm publish
```

詳細は [Changesets ドキュメント](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md) を参照。
