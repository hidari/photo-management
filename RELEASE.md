# リリースについて

## 配布パッケージのビルド

開発環境を含む配布用ZIPパッケージの生成:

```bash
deno task build-package
```

`dist/photo-management-v{VERSION}.zip` が生成されます。このZIPには以下が含まれます:

- 必要なツール（`tools/`）
- 設定ファイルのテンプレート（`config.example.ts`、`distribution.config.example.toml`）
- テンプレートファイル（`templates/`）
- 型定義（`types/`）
- ドキュメント（`docs/`）
- タスク定義（`deno.json`）
- 配布版README（`README.txt`）

## バージョン管理

バージョン番号は **Gitタグ** で管理されています。

- リリース版: `v1.0.0` → ビルド時に `1.0.0`
- 開発版: `v1.0.0-3-g1234abc` → ビルド時に `1.0.0-dev.3+g1234abc`
- タグなし: フォールバックとして `0.0.0-dev`

## リリース手順

1. リリース前確認を行う

**Lint実行:**
```bash
pnpm run lint:fix
```

**テスト実行:**
```bash
deno task test
```

**型チェック:**
```bash
deno check tools/**/*.ts tests/**/*.ts
```

2. リリース前確認が完了したら、バージョンタグを作成してプッシュ:

```bash
git tag v1.0.0
git push origin v1.0.0
```

3. GitHub Actionsが自動的にビルドを実行し、ReleasesページにZIPパッケージを公開

**重要**: タグとバージョンは自動的に同期されるため、`deno.json` の編集は不要です。
