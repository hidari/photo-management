# リリースについて

## 配布パッケージのビルド

開発環境を含む配布用ZIPパッケージの生成:

```bash
deno task build-package
```

`dist/photo-management-v{VERSION}.zip` が生成されます。このZIPには以下が含まれます:

- ライセンスファイル（`LICENSE`）
- パッケージ定義（`package.json`、GAS自動セットアップ用の依存関係定義）
- 必要なツール（`tools/`、ただし `build-package.ts` は除外）
- 設定ファイルのテンプレート（`config.example.ts`、`distribution.config.example.toml`）
- テンプレートファイル（`templates/`、ただし `DISTRIBUTION_README.txt` は除外）
- 型定義（`types/`）
- ドキュメント（`docs/`）
- Google Apps Script（`apps-script/`、ただし各プロジェクト配下の `dist/`, `tests/`, `.clasp.json`, `appsscript.json` は除外）
- タスク定義（`deno.json`、ただし `test`, `build-package`, `gas:*` タスクは除外）
- 配布版README（`README.txt`）

## バージョン管理

バージョン番号は **Gitタグ** で管理されています。

- リリース版: `v1.0.0` → ビルド時に `1.0.0`
- 開発版: `v1.0.0-3-g1234abc` → ビルド時に `1.0.0-dev.3+g1234abc`
- タグなし: フォールバックとして `0.0.0-dev`

## リリース手順

### ローカルでの事前確認（オプション）

リリース前にローカルで動作確認したい場合は、以下を実行してください：

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

**配布パッケージのビルドテスト:**
```bash
deno task build-package
```

### リリース実行

1. 変更をコミットし、mainブランチにプッシュ

2. バージョンタグを作成してプッシュ:

```bash
git tag v1.0.0
git push origin v1.0.0
```

3. GitHub Actionsが自動的に以下を実行:
   - 依存関係のインストール
   - Lint実行（`pnpm run lint:fix`）
   - テスト実行（`deno task test`）
   - 配布パッケージのビルド（`deno task build-package`）
   - ReleasesページにZIPパッケージと`build-info.json`を公開

4. [Releases](https://github.com/hidari/photo-management/releases) ページで公開されたパッケージを確認

**重要**:
- タグとバージョンは自動的に同期されるため、`deno.json` の編集は不要です
- Lint、テスト、ビルドはすべてGitHub Actionsで自動実行されます
- いずれかの検証で問題が発生した場合、リリースは失敗します
