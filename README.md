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

## 各ツールの基本的な使い方

### README生成

テンプレートから写真配布用のREADMEを生成します：

```bash
deno task readme
```

デフォルトでは `./Output/_README.txt` に出力されます。

オプション指定としてテンプレートや出力先をカスタマイズできます：

```bash
deno task readme --template ./templates/README.eta --output ./custom/path/README.txt
```

### イベント用ディレクトリ構造作成

イベント情報を記載したTOMLファイルから、モデルごとの配布用ディレクトリ構造を自動生成します。

1. 設定ファイルの作成

`directory.config.example.toml` を `directory.config.toml` にコピーして、イベント情報を記入してください：
```bash
cp directory.config.example.toml directory.config.toml
```

2. イベント情報の編集

`directory.config.toml` を開き、イベント情報を記入してください：

3. ディレクトリ構造の生成

以下のコマンドでディレクトリ構造を作成します：

```bash
 deno task dirs
```

各配布ディレクトリには自動的に `_README.txt` が生成され、実行後に `directory.config.toml` はイベントディレクトリ内に移動されます。

カスタム設定ファイルを使用する場合：

```bash
deno task dirs --config ./path/to/custom.toml
```

### 配布用アーカイブ作成

作成した配布用ディレクトリをzip形式にアーカイブします。

```bash
# 最新のイベントを自動検出してアーカイブ
deno task archive
```

スクリプトは以下の動作をします：
1. 最新のイベントディレクトリを自動検出
2. 配布用ディレクトリの一覧を表示
3. 確認後、各ディレクトリをzipにアーカイブ

イベントディレクトリまたは設定ファイルを指定する場合：

```bash
# イベントディレクトリを指定
deno task archive --event-dir ./path/to/20251012_アコスタATC

# TOMLファイルを直接指定
deno task archive --config ./path/to/directory.config.toml
```

**注意**: デフォルトでは [rip](https://github.com/hidari/rip-zip) コマンドを使用します。別のアーカイブツールを使用する場合は `config.ts` の `archiveTool` を設定してください。
