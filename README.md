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

## 基本的なワークフロー

1. `deno task init` でイベント情報を対話的に入力
2. `deno task dirs` でディレクトリ構造を作成
3. 各ディレクトリに写真を配置
4. 配布準備を一括実行:
   - **フォルダ共有方式**: `deno task ship-folders`
   - **zip配布方式**: `deno task ship`
5. `distribution.config.toml` 内の `intent_url` のURLを開き、必要に応じてDMの内容を確認・修正して送信

**個別実行する場合:**

#### フォルダ共有方式
4. `deno task upload-folders` で写真をフォルダとしてアップロード
5. `deno task distribution` で配布用メッセージ作成
6. `deno task intent` でXのDM送信URLを作成

#### zip配布方式
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
- `googleDrive`: Google Driveアップロード機能を使用する場合は設定（OAuth 2.0認証）
- `distributionRetentionDays`: 配布フォルダの保持期間(日数、デフォルト30日)
- `cleanupNotificationEmail`: 自動削除時の通知先メールアドレス（Google Apps Script使用時）

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

このツールを利用するには初回のみ OAuth 2.0 認証のセットアップが必要です。ブラウザでGoogleアカウントにログインするだけで、他のツール（gcloud CLIなど）のインストールは不要です。詳細は下記ドキュメントを参照してください。

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

### 8. Google Driveフォルダ共有アップロードツール

個別の写真ファイルをモデルごとのフォルダにアップロードし、フォルダ共有URLを自動取得します。モデルは必要な写真だけを選んでダウンロードできるため、スマホのストレージ容量を節約できます。

```bash
deno task upload-folders
```

**従来のzip配布との違い:**
- モデルは個別の写真を選んでダウンロード可能
- フォルダごと一括でzipダウンロードも可能
- Google Driveアプリでより快適に閲覧可能
- 検索結果に表示されない安全な共有設定

📄 [詳細なドキュメント](docs/Google%20Drive%E3%83%95%E3%82%A9%E3%83%AB%E3%83%80%E5%85%B1%E6%9C%89%E3%82%A2%E3%83%83%E3%83%97%E3%83%AD%E3%83%BC%E3%83%89%E3%83%84%E3%83%BC%E3%83%AB.md)

### 9. 古いフォルダ削除ツール

Google Drive上の古いイベントフォルダを削除して、ストレージを効率的に管理します。

```bash
# 削除対象を確認(dry-run)
deno task cleanup

# 実際に削除を実行
deno task cleanup --execute

# 保持期間を変更(60日)
deno task cleanup --execute --days 60
```

**Google Apps Scriptによる自動削除:**
トリガーで定期的に自動実行することも可能です。

📄 [詳細なドキュメント](docs/%E5%8F%A4%E3%81%84%E3%83%95%E3%82%A9%E3%83%AB%E3%83%80%E5%89%8A%E9%99%A4%E3%83%84%E3%83%BC%E3%83%AB.md)

### 10. 一括配布準備コマンド

アーカイブ作成からDMインテントURL生成までの配布準備工程を一括で実行します。

#### zip配布方式

```bash
deno task ship
```

1. `deno task archive` - zipファイルを作成
2. `deno task upload` - Google Driveにアップロード
3. `deno task distribution` - 配布用メッセージ作成
4. `deno task intent` - XのDM送信URLを作成

#### フォルダ共有方式

```bash
deno task ship-folders
```

1. `deno task upload-folders` - フォルダとして写真をアップロード
2. `deno task distribution` - 配布用メッセージ作成
3. `deno task intent` - XのDM送信URLを作成

各ステップが成功した場合のみ次のステップに進むため、エラーが発生した場合はその時点で処理が停止します。
