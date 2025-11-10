# 写真管理ツール 配布版

写真家がモデルに写真を配布する際に使用するツールです。このドキュメントは、配布版の使い方を説明します。

## 対象者

このツールはコマンドライン操作に慣れていたり、自動化に興味があるカメラマンを対象としています。

以下のような作業に抵抗がない方向けです：

- ターミナル/コマンドプロンプトでのコマンド実行
- テキストエディタでの設定ファイル編集
- Denoなどのランタイムのインストール

## ダウンロード

最新版は [GitHub Releases](https://github.com/hidari/photo-management/releases/latest) からダウンロードできます。

`photo-management-v{VERSION}.zip` をダウンロードして展開してください。

## 必要な環境

このツールを使用するには [Deno](https://deno.land/) が必要です。

### Denoのインストール

**macOS / Linux:**
```bash
curl -fsSL https://deno.land/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://deno.land/install.ps1 | iex
```

**Homebrew (macOS):**
```bash
brew install deno
```

インストール後、以下のコマンドでバージョンを確認できます：

```bash
deno --version
```

## セットアップ

### 対話式セットアップ（推奨）

ダウンロードして展開したディレクトリで、以下のコマンドを実行してください：

```bash
deno task setup
```

画面の指示に従って、以下の項目を設定します：

- `administrator`: あなたの名前
- `contacts`: 連絡先となるSNSアカウント（X、Blueskyなど）
- `developedDirectoryBase`: 現像済み画像を保存するディレクトリのパス
- `archiveTool`: 配布用zipファイルを作成するツールを指定（オプション）
- `googleDrive`: Google Driveアップロード機能を使用する場合は設定（OAuth 2.0認証）

設定ファイル（`config.ts`）は自動的に作成されます。

**注意**: 作成された `config.ts` は個人情報を含むため、公開しないでください。

### 手動セットアップ

対話式セットアップの代わりに、手動で設定ファイルを作成することもできます：

```bash
cp config.example.ts config.ts
```

その後、`config.ts` をテキストエディタで開いて編集してください。

### Google Driveのセットアップ（オプション）

Google Driveへのアップロード機能を使用する場合は、以下のドキュメントを参照してセットアップしてください：

[docs/Google Driveアップロードツール.md](docs/Google%20Drive%E3%82%A2%E3%83%83%E3%83%97%E3%83%AD%E3%83%BC%E3%83%89%E3%83%84%E3%83%BC%E3%83%AB.md)

## 基本的な使い方

### ワークフロー

1. イベント情報を初期化（ディレクトリ作成とREADME生成を含む）:
   ```bash
   deno task init
   ```
   画面の指示に従って、イベント日付、イベント名、モデル情報を入力します。
   モデルごとの配布用ディレクトリとREADMEが自動生成されます。

2. 生成されたディレクトリに写真を配置

3. モデルの追加（必要に応じて）:
   ```bash
   deno task add
   ```
   追加でモデルをアサインする場合に使用します。

4. アーカイブ作成とGoogle Driveアップロード:
   ```bash
   deno task upload
   ```
   写真をzipファイルにアーカイブし、Google Driveにアップロードします。

5. 配布メッセージ作成とDM送信URLの生成:
   ```bash
   deno task ship
   ```
   モデルへの配布メッセージとXのDM送信URLを自動生成します。

6. DMを送信:
   `distribution.config.toml` 内の `intent_url` のURLを開き、内容を確認してDMを送信

## 利用可能なコマンド

- `deno task setup` - セットアップ
- `deno task init` - イベント初期化
- `deno task add` - モデル追加
- `deno task upload` - アップロード
- `deno task ship` - 配布実行
- `deno task cleanup` - 古いフォルダ削除

詳細な使い方は各コマンドの実行時に表示されるヘルプや、`docs/` ディレクトリ内のドキュメントを参照してください。

## トラブルシューティング

### `deno` コマンドが見つからない

Denoが正しくインストールされているか、PATHが通っているか確認してください。

### 設定ファイルのエラー

`config.ts` が正しく作成されているか、必須項目が入力されているか確認してください。

### Google Drive関連のエラー

Google Cloud Projectの設定が正しく行われているか、認証情報が有効か確認してください。
詳細は [docs/Google Driveアップロードツール.md](docs/Google%20Drive%E3%82%A2%E3%83%83%E3%83%97%E3%83%AD%E3%83%BC%E3%83%89%E3%83%84%E3%83%BC%E3%83%AB.md) を参照してください。

### その他の問題

問題が発生した場合は、[GitHub Issues](https://github.com/hidari/photo-management/issues) で報告してください。

## 開発者向け情報

リポジトリをクローンして開発環境で作業したい場合は、[README.md](./README.md) を参照してください。

## ライセンス

MIT License
