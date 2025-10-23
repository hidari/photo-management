# photo-management

写真管理用のドキュメントやツールなどのセットを管理するリポジトリです。

いくつかのツールがセットになっているため、必要なものだけ使うことも可能です。

## 必要な環境

このリポジトリのツールを使用するには **Deno** が必要です。

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

詳細なインストール手順は [Deno公式サイト](https://deno.land/) を参照してください。

## 基本的なワークフロー

1. `deno task init` でイベント情報を対話的に入力
2. `deno task dirs` でディレクトリ構造を作成
3. 各ディレクトリに写真を配置
4. `deno task archive` でzipファイルを作成
5. `deno task upload` でGoogle Driveにアップロード

## セットアップ

### 1. 設定ファイルの作成

`config.example.ts` を `config.ts` にコピーして、設定を記入してください：

```bash
cp config.example.ts config.ts
```

### 2. 設定項目の編集

`config.ts` を開き、以下の項目を設定してください：

- `administrator`: あなたの名前
- `contacts`: 連絡先となるSNSアカウント（X、Blueskyなど）
- `developedDirectoryBase`: 現像済み画像を保存するディレクトリのパス
- `archiveTool`: 配布用zipファイルを作成するツールを指定（オプション）
- `googleCloud`: Google Driveアップロード機能を使用する場合は設定

## 利用可能なツール

このリポジトリには写真配布を効率化する以下のツールが含まれています。

### 1. README生成ツール

テンプレートから写真配布用のREADMEを生成します。

```bash
deno task readme
```

📄 [詳細なドキュメント](docs/README%E7%94%9F%E6%88%90%E3%83%84%E3%83%BC%E3%83%AB.md)

### 2. イベント情報初期化ツール

対話的にイベント情報（日付、イベント名、モデル情報）を入力し、`directory.config.toml` を作成するツールです。

```bash
deno task init
```

画面の指示に従って以下の情報を入力します：
- イベント日付（YYYYMMDD形式）
- イベント名
- モデル情報（名前、初回撮影かどうか、SNS URL）

📄 [詳細なドキュメント](docs/%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88%E6%83%85%E5%A0%B1%E5%88%9D%E6%9C%9F%E5%8C%96%E3%83%84%E3%83%BC%E3%83%AB.md)

### 3. ディレクトリ構造作成ツール

イベント情報からモデルごとの配布用ディレクトリ構造を自動生成します。

`deno task init` で作成された `directory.config.toml` を使用して、以下のコマンドでディレクトリ構造を生成：

```bash
deno task dirs
```

📄 [詳細なドキュメント](docs/%E3%83%87%E3%82%A3%E3%83%AC%E3%82%AF%E3%83%88%E3%83%AA%E6%A7%8B%E9%80%A0%E4%BD%9C%E6%88%90%E3%83%84%E3%83%BC%E3%83%AB.md)

### 4. アーカイブ作成ツール

配布用ディレクトリをzip形式にアーカイブします。

```bash
deno task archive
```

📄 [詳細なドキュメント](docs/%E3%82%A2%E3%83%BC%E3%82%AB%E3%82%A4%E3%83%96%E4%BD%9C%E6%88%90%E3%83%84%E3%83%BC%E3%83%AB.md)

### 5. Google Driveアップロードツール

zipファイルをGoogle Driveにアップロードし、共有URLを自動取得します。

なお、このツールを利用するにはGoogle Cloudのプロジェクトを事前に作成する必要があります。プロジェクトのセットアップについては下記詳細ドキュメントを参照してください。

```bash
deno task upload
```

📄 [詳細なドキュメント](docs/Google%20Drive%E3%82%A2%E3%83%83%E3%83%97%E3%83%AD%E3%83%BC%E3%83%89%E3%83%84%E3%83%BC%E3%83%AB.md)

### 6. 配布メッセージ生成ツール

モデルごとの配布用メッセージを自動生成し、`directory.config.toml`に追記します。Google Driveのダウンロードリンクを含む連絡文がTOMLファイルの各モデルセクションに`message`フィールドとして追加されます。

```bash
deno task distribution
```

📄 [詳細なドキュメント](docs/%E9%85%8D%E5%B8%83%E3%83%A1%E3%83%83%E3%82%BB%E3%83%BC%E3%82%B8%E7%94%9F%E6%88%90%E3%83%84%E3%83%BC%E3%83%AB.md)
