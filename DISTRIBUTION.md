# 写真管理ツール 配布版

写真家がモデルに写真を配布する際に使用するツールです。このドキュメントは、配布版の使い方を説明します。

## 対象者

このツールはコマンドライン操作に慣れていたり、自動化に興味があるカメラマンを対象としています。以下のような作業に抵抗がない方向けです：

- ターミナル/コマンドプロンプトでのコマンド実行
- テキストエディタでの設定ファイル編集
- Denoなどのランタイムのインストール

## ダウンロード

最新版は [GitHub Releases](https://github.com/hidari/photo-management/releases/latest) からダウンロードできます。

`photo-management-v{VERSION}.zip` をダウンロードして展開してください。

## 必要な環境

このツールを使用するには **Deno** が必要です。

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

詳細なインストール手順は https://deno.land/ を参照してください。

## セットアップ

### 1. 設定ファイルの作成

ダウンロードして展開したディレクトリで、以下のコマンドを実行してください：

```bash
cp config.example.ts config.ts
```

### 2. 設定項目の編集

`config.ts` をテキストエディタで開き、以下の項目を設定してください：

- `administrator`: あなたの名前
- `contacts`: 連絡先となるSNSアカウント（X、Blueskyなど）
- `developedDirectoryBase`: 現像済み画像を保存するディレクトリのパス
- `archiveTool`: 配布用zipファイルを作成するツールを指定（オプション）
- `googleCloud`: Google Driveアップロード機能を使用する場合は設定

**注意**: このファイルは機密情報を含むため、公開しないでください。

### 3. Google Driveのセットアップ（オプション）

Google Driveへのアップロード機能を使用する場合は、以下のドキュメントを参照してセットアップしてください：

[docs/Google Driveアップロードツール.md](docs/Google%20Drive%E3%82%A2%E3%83%83%E3%83%97%E3%83%AD%E3%83%BC%E3%83%89%E3%83%84%E3%83%BC%E3%83%AB.md)

## 基本的な使い方

### ワークフロー

1. **イベント情報を初期化:**
   ```bash
   deno task init
   ```
   画面の指示に従って、イベント日付、イベント名、モデル情報を入力します。

2. **ディレクトリ構造を作成:**
   ```bash
   deno task dirs
   ```
   モデルごとの配布用ディレクトリが自動生成されます。

3. **生成されたディレクトリに写真を配置**

4. **配布準備を一括実行:**
   ```bash
   deno task ship
   ```
   以下の処理が順次実行されます：
   - ZIPアーカイブ作成
   - Google Driveへのアップロード
   - 配布用メッセージ生成
   - XのDM送信URL生成

5. **DMを送信:**
   `distribution.config.toml` 内の `intent_url` のURLを開き、内容を確認・修正してDMを送信

### 個別実行する場合

4の一括実行の代わりに、以下を順に実行できます：

```bash
deno task archive      # zipファイルを作成
deno task upload       # Google Driveにアップロード
deno task distribution # 配布用メッセージ作成
deno task intent       # XのDM送信URLを作成
```

## 利用可能なコマンド

- `deno task init` - イベント初期化
- `deno task readme` - README生成
- `deno task dirs` - ディレクトリ作成
- `deno task archive` - アーカイブ作成
- `deno task upload` - Google Driveアップロード
- `deno task distribution` - 配布ドキュメント作成
- `deno task intent` - X用DMのURL生成
- `deno task ship` - 配布一括実行

詳細な使い方は各ツールのドキュメント（`docs/` ディレクトリ内）を参照してください。

## トラブルシューティング

### コマンドが見つからない

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
