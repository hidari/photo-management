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

### Google Driveへのアップロード

作成したzipファイルをGoogle Driveにアップロードし、共有URLをTOMLファイルに記録します。

#### 初回セットアップ

⚠️ **重要**: 各ユーザーが自分のGoogle Cloudプロジェクトを作成してください。このツールの開発者のAPIクォータを使用するわけではありません。各ユーザーが独立して自分のGoogle Driveにアクセスします。

1. **Google Cloud Consoleでプロジェクトを作成**

   [Google Cloud Console](https://console.cloud.google.com/) にアクセスし、新しいプロジェクトを作成します。

2. **Google Drive APIを有効化**

   - プロジェクトのダッシュボードから「APIとサービス」→「ライブラリ」を開く
   - 「Google Drive API」を検索して有効化

3. **OAuth 2.0クライアントIDを作成**

   - 「APIとサービス」→「認証情報」を開く
   - 「認証情報を作成」→「OAuth クライアント ID」を選択
   - アプリケーションの種類：**「デスクトップアプリ」**を選択
   - 名前を入力して作成

   ⚠️ **重要**: アプリケーションの種類は必ず「デスクトップアプリ」を選択してください。他の種類（ウェブアプリケーションなど）では正常に動作しません。

4. **認証情報をダウンロード**

   - 作成したクライアントIDの右側にあるダウンロードボタンをクリック
   - ダウンロードしたJSONファイルを `credentials.json` として保存

5. **認証情報を配置**

   ```bash
   mkdir -p ~/.config/photo-management
   mv ~/Downloads/credentials.json ~/.config/photo-management/
   ```

   **トラブルシューティング**: ダウンロードしたJSONファイルの `redirect_uris` が `["http://localhost"]` になっている場合、テキストエディタで以下のように修正してください：

   変更前：
   ```
   "redirect_uris": ["http://localhost"]
   ```

   変更後：
   ```
   "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob"]
   ```

   この設定により、認証後にブラウザに認証コードが直接表示されます。

6. **OAuth同意画面でテストユーザーを追加**

   開発中のアプリは「テストモード」のため、使用する前にテストユーザーの登録が必要です：

   - Google Cloud Consoleの「APIとサービス」→「OAuth同意画面」を開く
   - 下にスクロールして「テストユーザー」セクションを探す
   - 「+ ADD USERS」をクリック
   - 自分のGoogleアカウントのメールアドレスを入力
   - 「保存」

   ⚠️ この手順をスキップすると、認証時に「アクセスをブロック: このアプリは Google の審査プロセスを完了していません」というエラーが表示されます。

#### アップロードの実行

```bash
# 最新のイベントを自動検出してアップロード
deno task upload

# イベントディレクトリを指定
deno task upload --event-dir ./path/to/20251012_アコスタATC

# TOMLファイルを直接指定
deno task upload --config ./path/to/directory.config.toml

# アップロード後にローカルのzipファイルを削除
deno task upload --delete-after-upload
```

スクリプトは以下の動作をします：

1. 初回実行時はブラウザで認証URLを開き、Googleアカウントでログイン
2. 表示される認証コードをターミナルに入力
3. 認証情報を `~/.config/photo-management/token.json` に保存（次回以降は再認証不要）
4. Google Drive上に「PhotoDistribution」フォルダを自動作成（初回のみ）
5. イベント別のフォルダを作成し、zipファイルをアップロード
6. 各ファイルの共有リンクを取得
7. TOMLファイルの各モデルの `download_url` フィールドに共有URLを記録
8. `--delete-after-upload` フラグが指定されている場合、ローカルのzipファイルを削除

**フォルダ構成例**:
```
マイドライブ/
└── PhotoDistribution/
    ├── 20251012_アコスタATC/
    │   ├── 20251012_アコスタATC_撮影者名_Aさん.zip
    │   └── 20251012_アコスタATC_撮影者名_Bさん.zip
    └── 20251013_次のイベント/
        └── ...
```

#### トラブルシューティング

**認証エラー（401 Unauthorized）が発生する場合**

以下のエラーが表示される場合：
```
❌ エラー: フォルダ検索に失敗しました: {"error": {"code": 401, "message": "Request had invalid authentication credentials...
```

**原因**: 保存されているトークンが無効または期限切れです。

**対処法**: スクリプトを再実行してください。無効なトークンは自動的に検出・削除され、再認証フローが開始されます：

```bash
deno task upload
```

スクリプトが以下のように表示します：
1. `⚠️  保存されているトークンが無効です`
2. リフレッシュトークンがある場合は自動的にリフレッシュを試行
3. リフレッシュできない場合は再認証URLを表示

**手動でトークンを削除する場合**:
```bash
rm ~/.config/photo-management/token.json
rm ~/.config/photo-management/folder-id.txt
deno task upload
```

**テスト実行後に認証エラーが出る場合**

`deno task test` の実行後に本番の認証ファイルが削除されることはありません（テスト用の一時ディレクトリを使用しています）。それでもエラーが出る場合は、上記の手動削除手順を実行してください。
