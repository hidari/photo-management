# photo-management

写真管理用のドキュメントやツールなどのセットを管理するリポジトリです。

いくつかのツールがセットになっているため、必要なものだけ使うことも可能です。

## 配布版について

コマンドライン操作に慣れていたり、自動化に興味があるカメラマン向けに、配布用パッケージを用意しています。

必要なファイルだけまとめたZIPファイルをダウンロードして展開、Denoをインストールするだけで使用できます。詳しくは [配布版ドキュメント](DISTRIBUTION.md) をご覧ください。

- [最新版のダウンロード（GitHub Releases）](https://github.com/hidari/photo-management/releases/latest)

---

以下はリポジトリをクローンして開発環境で使用する方法です。配布版を使う場合は読み飛ばしてください。

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

## クイックスタート

初めて使う方は以下の手順で始められます：

```bash
# 1. 初期設定（対話式で config.ts 作成、ripバイナリ、OAuth認証）
deno task setup

# 2. イベント作成（イベント情報入力、ディレクトリ作成、README生成）
deno task init

# 3. 各モデルのディレクトリに写真を配置

# 4. Google Driveにアップロードして配布準備
deno task upload --all

# 5. モデルへDM送信
deno task ship
```

## 基本的なワークフロー

### 1. 初回セットアップ

```bash
deno task setup
```

対話的に以下を設定します：
- config.ts の作成（管理者名、連絡先、保存先ディレクトリ）
- ripバイナリのダウンロード（高速アーカイブ作成用）
- Google Drive OAuth認証（アップロード機能を使用する場合）

### 2. イベント作成

```bash
deno task init
```

イベント情報（日付、イベント名、モデル情報）を入力すると：
- イベント用ディレクトリ自動作成
- 各モデルの配布用ディレクトリ作成
- README.txt ファイル生成
- distribution.config.toml 保存

### 3. 写真配置

作成されたディレクトリ（`YYYYMMDD_イベント名/DIST_DIR_モデル名さん/`）に現像済み写真を配置します。

### 4. アップロードと配布準備

```bash
# フォルダ配布（推奨）: モデルが個別の写真を選んでダウンロード可能
deno task upload --all

# zip配布: 全写真を1つのzipファイルにまとめて配布
deno task upload --all --as-archive
```

このコマンドで以下が自動実行されます：
- Google Driveへのアップロード
- 配布メッセージ生成
- X（Twitter）DM送信用URL生成（SNS設定がある場合）

### 5. モデルへDM送信

```bash
deno task ship
```

対話的にモデルを選択して、ブラウザでDM画面を開きます。

## セットアップ

### 自動セットアップ（推奨）

```bash
deno task setup
```

対話的に以下を設定できます：
- `config.ts` の作成
- ripバイナリのダウンロード
- Google Drive OAuth認証

### 手動セットアップ

#### 1. 設定ファイルの作成

`config.example.ts` を `config.ts` にコピーして編集：

```bash
cp config.example.ts config.ts
```

#### 2. 必須項目

- `administrator`: あなたの名前
- `developedDirectoryBase`: 現像済み画像を保存するディレクトリのパス

#### 3. オプション項目

- `contacts`: 連絡先SNSアカウント（X、Blueskyなど）
- `googleDrive`: OAuth 2.0認証設定（clientId, clientSecret）
- `archiveTool`: zip作成ツール（未設定の場合は自動ダウンロード）
- `distributionRetentionDays`: 配布フォルダの保持期間（デフォルト30日）
- `cleanupNotificationEmail`: 自動削除通知先メール

**注意**: `config.ts` は公開しないでください。

## 利用可能なコマンド

新しい統合コマンドにより、写真配布プロセスが大幅に簡素化されました。

### 1. setup - 初期設定

プロジェクトの初期設定を対話的に実行します。

```bash
deno task setup
```

**実行内容:**
- config.ts の作成（管理者名、連絡先、保存先ディレクトリ）
- ripバイナリのダウンロード（高速アーカイブ作成用）
- Google Drive OAuth認証（任意）
- Google Apps Script設定案内（任意）

**初回のみ実行すればOKです。**

### 2. init - イベント初期化

新しいイベントを作成し、配布用ディレクトリを準備します。

```bash
# 対話的にイベント情報を入力
deno task init

# 既存のtomlから作成
deno task init --config ./path/to/config.toml
```

**実行内容:**
- イベント情報の入力（日付、イベント名、モデル情報）
- ディレクトリ構造の自動作成
- README.txt ファイルの生成
- distribution.config.toml の保存

**入力項目:**
- イベント日付（YYYYMMDD形式）
- イベント名
- モデル情報（名前、初回撮影か、SNS URL）

### 3. add - モデル追加

既存イベントに新しいモデルを追加します。

```bash
# tomlを編集後、差分を同期
deno task add

# 対話的にモデルを追加
deno task add --dialog

# 特定のtomlを指定
deno task add --config ./path/to/config.toml
```

**実行内容:**
- 新しいモデルのディレクトリ作成
- README.txt ファイル生成
- distribution.config.toml 更新

### 4. upload - アップロード統合

Google Driveへのアップロード、メッセージ生成、インテントURL生成を一括実行します。

```bash
# 全モデルをフォルダ配布（推奨）
deno task upload --all

# 全モデルをzip配布
deno task upload --all --as-archive

# 対話的に選択
deno task upload

# アップロード後にローカルzipを削除
deno task upload --all --as-archive --delete-after-upload
```

**実行内容:**
- Google Driveへのアップロード
  - フォルダ配布: 個別写真をアップロード（モデルが選んでダウンロード可能）
  - zip配布: zipファイルをアップロード
- 配布メッセージの自動生成
- X（Twitter）DM送信用URL生成（SNS設定がある場合）
- distribution.config.toml 自動更新

**オプション:**
- `--all`: 全モデルを処理
- `--as-archive`: zip配布方式（デフォルトはフォルダ配布）
- `--delete-after-upload`: アップロード後にローカルzipを削除
- `--config`: tomlファイルを指定

### 5. ship - 配布実行

モデルへの配布メッセージ送信とフラグ管理を行います。

```bash
deno task ship

# 配布済みモデルも含める
deno task ship --force
```

**実行内容:**
- 配布可能なモデルのリスト表示
- 対話的にモデルを選択
- 配布メッセージのプレビュー
- ブラウザでDM画面を開く
- 配布済みフラグの更新

**オプション:**
- `--force`: 配布済みモデルも再配布対象に含める
- `--config`: tomlファイルを指定

## その他の便利なコマンド

### cleanup - 古いフォルダ削除

Google Drive上の古いイベントフォルダを削除してストレージを管理します。

```bash
# 削除対象を確認(dry-run)
deno task cleanup

# 実際に削除を実行
deno task cleanup --execute

# 保持期間を変更(60日)
deno task cleanup --execute --days 60
```

📄 [詳細なドキュメント](docs/%E5%8F%A4%E3%81%84%E3%83%95%E3%82%A9%E3%83%AB%E3%83%80%E5%89%8A%E9%99%A4%E3%83%84%E3%83%BC%E3%83%AB.md)
