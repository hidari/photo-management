# CLAUDE.md

このファイルは、このリポジトリで作業する際にClaude Code (claude.ai/code) にガイダンスを提供します。

## プロジェクト概要

写真管理用のリポジトリです。写真家がモデルに写真を配布する際に使用するドキュメント、ツール、テンプレートを管理します。

## 開発環境

- **ランタイム**: Deno (TypeScript)
- **パッケージマネージャー**: pnpm
- **リンター/フォーマッター**: Biome

## よく使うコマンド

### 開発用コマンド

#### Lint/Format
リポジトリルートで以下を実行:

```bash
pnpm run lint:fix
```

設定は `./biome.jsonc` を参照。

#### テスト実行
```bash
deno task test
```

カバレッジ閾値は40%に設定されています。

### 写真配布ツール

#### 初期設定
```bash
deno task setup
```

**初回のみ実行:**
- config.ts の作成
- ripバイナリのダウンロード
- Google Drive OAuth認証

#### イベント作成
```bash
deno task init
```

**実行内容:**
- イベント情報の対話的入力
- ディレクトリ構造の自動作成
- README.txt の生成
- distribution.config.toml の保存

#### モデル追加
```bash
# toml編集後、差分を同期
deno task add

# 対話的に追加
deno task add --dialog
```

#### アップロード統合
```bash
# フォルダ配布（推奨）
deno task upload --all

# zip配布
deno task upload --all --as-archive
```

**実行内容:**
- Google Driveへのアップロード
- 配布メッセージ生成
- インテントURL生成（X連携）
- distribution.config.toml 自動更新

#### 配布実行
```bash
deno task ship
```

**実行内容:**
- 対話的にモデル選択
- ブラウザでDM画面を開く
- 配布済みフラグの更新

### ツールの実行
denoスクリプトは `deno task` でリポジトリのルートから実行されることを前提としています。

## アーキテクチャ

### 設定システム
- **config.example.ts**: config.tsを作成するためのテンプレート
- **types/config.ts**: Config インターフェースのTypeScript型定義

### テンプレートシステム
このプロジェクトはテンプレートエンジンとして **Eta** を使用しています。

- **templates/README.eta**: 写真配布用READMEファイルを生成するメインテンプレート
- **tools/generate-readme.ts**: 設定データとテンプレートを組み合わせて出力を生成するスクリプト

## コミットメッセージ

コミットメッセージの一行目は必ず適切なConventional Commits準拠のプレフィックスを使用してください：

- `feat:` 新機能の追加
- `fix:` バグ修正
- `docs:` ドキュメントの更新・追加
- `style:` コードスタイル（フォーマット、セミコロンなど）
- `refactor:` 既存機能のリファクタリング
- `test:` テスト関連（追加・修正・削除）
- `chore:` その他の作業（依存関係更新、設定変更など）
- `ci:` CI/CD関連の変更
- `perf:` パフォーマンス改善
- `build:` ビルドシステムや外部依存関係の変更

### コミットメッセージ例
```
feat: React Router v7フロントエンド基盤を実装

- CSS Modules + Biome開発環境セットアップ
- Welcome画面とCloudflare Workers統合
```

## 必ず守ること

- コメントとドキュメントの主要言語は**日本語**です
- 個人情報を含む設定ファイルはコミットしてはいけません（config.tsはgitignoreされています）
- ハルシネーションを極力避けてわからないことはわからないと言ってください
- コマンドを実行する際は実行前に `pwd` で現在のディレクトリを確認してからコマンドを実行してください
- ファイルを書き換える際、ファイルの末尾は必ず空行にしてください
- ファイルの編集が完了したら `pnpm run lint:fix` を実行したあと `deno task test` を実行してすべてのテストを通してください
