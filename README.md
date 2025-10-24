# photo-management

写真管理用のドキュメントやツールなどのセットを管理するリポジトリです。

いくつかのツールがセットになっているため、必要なものだけ使うことも可能です。

## 配布版について

**非技術者向けに、開発環境不要で使える配布版を用意しています。**

Denoをインストールせずに、ダブルクリックで起動できる実行ファイルをダウンロードできます。詳しくは [配布版ドキュメント](DISTRIBUTION.md) をご覧ください。

- [最新版のダウンロード（GitHub Releases）](https://github.com/YOUR_USERNAME/photo-management/releases/latest)

---

以下は開発環境での使用方法です。配布版を使う場合は読み飛ばしてください。

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
4. `deno task ship` で配布準備を一括実行（archive → upload → distribution → intent）
5. `distribution.config.toml` 内の `intent_url` のURLを開き、必要に応じてDMの内容を確認・修正して送信

**個別実行する場合:**

4. `deno task archive` でzipファイルを作成
5. `deno task upload` でGoogle Driveにアップロード
6. `deno task distribution` で配布用メッセージ作成
7. `deno task intent` でXのDM送信URLを作成

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

**注意**: このファイルは公開しないでください。

## 利用可能なツール

このリポジトリには写真配布を効率化する以下のツールが含まれています。

### 1. README生成ツール

テンプレートから写真配布用のREADMEを生成します。

```bash
deno task readme
```

📄 [詳細なドキュメント](docs/README%E7%94%9F%E6%88%90%E3%83%84%E3%83%BC%E3%83%AB.md)

### 2. イベント情報初期化ツール

対話的にイベント情報（日付、イベント名、モデル情報）を入力し、`distribution.config.toml` を作成するツールです。

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

`deno task init` で作成された `distribution.config.toml` を使用して、以下のコマンドでディレクトリ構造を生成：

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

モデルごとの配布用メッセージを自動生成し、`distribution.config.toml`に追記します。Google Driveのダウンロードリンクを含む連絡文がTOMLファイルの各モデルセクションに`message`フィールドとして追加されます。

```bash
deno task distribution
```

📄 [詳細なドキュメント](docs/%E9%85%8D%E5%B8%83%E3%83%A1%E3%83%83%E3%82%BB%E3%83%BC%E3%82%B8%E7%94%9F%E6%88%90%E3%83%84%E3%83%BC%E3%83%AB.md)

### 7. XのDMインテント作成ツール

各モデルのXアカウントのDM画面を直接開くURLを生成し`distribution.config.toml`に追記します。リンクにアクセスするだけで配布メッセージが入力された状態でDM画面が開くため、写真配布の手間を大幅に削減できます。

```bash
deno task intent
```

📄 [詳細なドキュメント](docs/X%E3%81%AEDM%E3%82%A4%E3%83%B3%E3%83%86%E3%83%B3%E3%83%88%E4%BD%9C%E6%88%90%E3%83%84%E3%83%BC%E3%83%AB.md)

### 8. 一括配布準備コマンド

アーカイブ作成からDMインテントURL生成までの配布準備工程（archive → upload → distribution → intent）を一括で実行します。各ステップを個別に実行する必要がなく、一度のコマンドで配布準備が完了します。

```bash
deno task ship
```

このコマンドは以下のタスクを順次実行します：

1. `deno task archive` - zipファイルを作成
2. `deno task upload` - Google Driveにアップロード
3. `deno task distribution` - 配布用メッセージ作成
4. `deno task intent` - XのDM送信URLを作成

各ステップが成功した場合のみ次のステップに進むため、エラーが発生した場合はその時点で処理が停止します。

## 開発者向け

### CLIメニューシステム

対話的なメニュー形式で全ツールを実行できるCLIを提供しています：

```bash
deno task cli
```

起動すると以下のようなメニューが表示されます：

```
========================================
     写真管理ツール
========================================

操作を選択してください:

[1] イベント初期化
[2] README生成
[3] ディレクトリ作成
[4] アーカイブ作成
[5] アップロード
[6] 配布ドキュメント作成
[7] Intent URL生成
[8] 配布一括実行

[q] 終了
```

### ビルド手順

クロスプラットフォーム対応の配布パッケージ（ZIP）を生成できます：

```bash
deno task build-cli
```

以下のプラットフォーム向けZIPパッケージが `dist/` ディレクトリに生成されます：

- Windows (x64): `photo-manager-v1.0.0-windows-x64.zip`
- macOS (Intel): `photo-manager-v1.0.0-macos-x64.zip`
- macOS (Apple Silicon): `photo-manager-v1.0.0-macos-arm64.zip`
- Linux (x64): `photo-manager-v1.0.0-linux-x64.zip`

各ZIPファイルには以下が含まれます：
- 実行ファイル `photo-manager` (または `photo-manager.exe`)
- 配布用README.txt

Unix系（macOS/Linux）の実行ファイルには実行権限（755）が設定済みです。

### バージョン管理

バージョン番号は **Gitタグ** で管理されています。

- リリース版: `v1.0.0` → ビルド時に `1.0.0`
- 開発版: `v1.0.0-3-g1234abc` → ビルド時に `1.0.0-dev.3+g1234abc`
- タグなし: フォールバックとして `0.0.0-dev`

ローカルでビルドする場合、`git describe` コマンドで自動的にバージョンを取得します。

### リリース手順

1. リリース準備が完了したら、バージョンタグを作成してプッシュ:

```bash
git tag v1.0.0
git push origin v1.0.0
```

2. GitHub Actionsが自動的にビルドを実行し、ReleasesページにZIPパッケージを公開

**重要**: タグとバージョンは自動的に同期されるため、`deno.json` の編集は不要です。

### 開発・テスト

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
