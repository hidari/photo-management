# photo-management

写真管理用のドキュメントやツールなどのセットを管理するリポジトリです。

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

1. `deno task dirs` でディレクトリ構造を作成
2. 各ディレクトリに写真を配置
3. `deno task archive` でzipファイルを作成
4. `deno task upload` でGoogle Driveにアップロード

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

📄 [詳細なドキュメント](Docs/README%E7%94%9F%E6%88%90%E3%83%84%E3%83%BC%E3%83%AB.md)

### 2. ディレクトリ構造作成ツール

イベント情報からモデルごとの配布用ディレクトリ構造を自動生成します。

まず、設定ファイルをコピーしてイベント情報を記入してください：

```bash
cp directory.config.example.toml directory.config.toml
# directory.config.toml を編集してイベント情報を記入
```

その後、以下のコマンドでディレクトリ構造を生成：

```bash
deno task dirs
```

📄 [詳細なドキュメント](Docs/%E3%83%87%E3%82%A3%E3%83%AC%E3%82%AF%E3%83%88%E3%83%AA%E6%A7%8B%E9%80%A0%E4%BD%9C%E6%88%90%E3%83%84%E3%83%BC%E3%83%AB.md)

### 3. アーカイブ作成ツール

配布用ディレクトリをzip形式にアーカイブします。

```bash
deno task archive
```

📄 [詳細なドキュメント](Docs/%E3%82%A2%E3%83%BC%E3%82%AB%E3%82%A4%E3%83%96%E4%BD%9C%E6%88%90%E3%83%84%E3%83%BC%E3%83%AB.md)

### 4. Google Driveアップロードツール

zipファイルをGoogle Driveにアップロードし、共有URLを自動取得します。

なお、このツールを利用するにはGoogle Cloudのプロジェクトを事前に作成する必要があります。プロジェクトのセットアップについては下記詳細ドキュメントを参照してください。

```bash
deno task upload
```

📄 [詳細なドキュメント](Docs/Google%20Drive%E3%82%A2%E3%83%83%E3%83%97%E3%83%AD%E3%83%BC%E3%83%89%E3%83%84%E3%83%BC%E3%83%AB.md)

### 5. 配布メッセージ生成ツール

モデルごとの配布用メッセージを自動生成します。Google Driveのダウンロードリンクを含む連絡文を一括作成できます。

```bash
deno task distribution
```

📄 [詳細なドキュメント](Docs/%E9%85%8D%E5%B8%83%E3%83%A1%E3%83%83%E3%82%BB%E3%83%BC%E3%82%B8%E7%94%9F%E6%88%90%E3%83%84%E3%83%BC%E3%83%AB.md)
