# Google Driveアップロードツール

作成したzipファイルをGoogle Driveにアップロードし、共有URLをTOMLファイルに記録するツールです。

## 初回セットアップ

⚠️ **重要**: 各ユーザーが自分のGoogle Cloudプロジェクトを作成してください。

このツールの開発者のAPIクォータを使用するわけではありません。
各ユーザーが独立して自分のGoogle Driveにアクセスします。

### 1. Google Cloud SDKのインストール

[Google Cloud SDK公式サイト](https://cloud.google.com/sdk/docs/install) からインストールしてください。

**macOS (Homebrew):**
```bash
brew install google-cloud-sdk
```

**その他のOS**: 公式サイトの手順に従ってインストールしてください。

インストール後、以下のコマンドで確認：
```bash
gcloud --version
```

### 2. Google Cloud Consoleでの設定

[Google Cloud Console](https://console.cloud.google.com/) にアクセスします。

#### プロジェクトの作成

1. 画面上部のプロジェクト選択ドロップダウンから「新しいプロジェクト」を選択
2. プロジェクト名を入力（例: `photo-management`）
3. プロジェクトIDをメモしておく（後で設定ファイルに記述します）
4. 「作成」をクリック

#### Google Drive APIの有効化

1. 左側メニューから「APIとサービス」→「ライブラリ」を開く
2. 「Google Drive API」を検索
3. 「有効にする」をクリック

#### 課金アカウントの設定（必要に応じて）

- Google Drive APIの無料枠は個人利用に十分ですが、課金アカウントの設定を求められる場合があります
- 左側メニューから「お支払い」を選択し、画面の指示に従って設定してください
- 無料枠を超えない限り請求は発生しません（基本的に超えないはず）

### 3. 設定ファイルの編集

`config.ts` に Google Cloud プロジェクトIDを追加：

```typescript
export default {
  // 既存の設定...

  googleCloud: {
    projectId: 'your-project-id-here', // ステップ2でメモしたプロジェクトID
  },
} satisfies Config;
```

### 4. 認証の実行

以下のコマンドで認証を行います（初回のみ）：

```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/drive.file
```

ブラウザが開き、Googleアカウントでのログインを求められます。画面の指示に従って認証を完了してください。

**重要**: スコープを `https://www.googleapis.com/auth/drive.file` に制限することで、このツールが作成したファイルのみにアクセスを制限しています。

**補足**: gcloudのデフォルトプロジェクトを変更する必要はありません。このツールは設定ファイルで指定したプロジェクトのクォータを使用するため、他のプロジェクトで作業中でもそのまま実行できます。

## アップロードの実行

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

## 実行内容

スクリプトは以下の動作をします：

1. gcloud認証を確認
2. 認証されているGoogleアカウントと使用するプロジェクトIDを表示
3. Google Drive上に「PhotoDistribution」フォルダを自動作成（初回のみ）
4. イベント別のフォルダを作成し、zipファイルをアップロード
5. 各ファイルの共有リンクを取得
6. TOMLファイルの各モデルの `download_url` フィールドに共有URLを記録
7. `--delete-after-upload` フラグが指定されている場合、ローカルのzipファイルを削除

## フォルダ構成

```
マイドライブ/
└── PhotoDistribution/
    ├── 20251012_アコスタATC/
    │   ├── 20251012_アコスタATC_撮影者名_Aさん.zip
    │   └── 20251012_アコスタATC_撮影者名_Bさん.zip
    └── 20251013_次のイベント/
        └── ...
```

## オプション

- `--event-dir`: アップロード対象のイベントディレクトリを指定
- `--config`: TOMLファイルのパスを指定
- `--delete-after-upload`: アップロード後にローカルのzipファイルを削除

## トラブルシューティング

### gcloud CLIが見つからない

```
❌ エラー: gcloud CLIが見つかりません。
```

**対処法**: Google Cloud SDKをインストールしてください。上記の「初回セットアップ」のステップ1を参照してください。

### 認証エラーが発生する

```
❌ エラー: gcloud認証が必要です
```

**対処法**: 以下のコマンドで認証してください：

```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/drive.file
```

### 認証済みなのにエラーが出る

トークンの有効期限が切れている可能性があります。gcloudは自動的にトークンをリフレッシュしますが、問題が解決しない場合は再認証してください：

```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/drive.file
```

### APIクォータエラーが発生する

```
❌ エラー: APIクォータを超過しました
```

実行時に表示されるプロジェクトIDのクォータが使用されます。Google Cloud Consoleでクォータを確認してください：

`https://console.cloud.google.com/apis/api/drive.googleapis.com/quotas?project=YOUR_PROJECT_ID`

### 間違ったプロジェクトが使用されている

実行時に表示される「使用するプロジェクト」を確認してください。間違っている場合は、`config.ts` の `googleCloud.projectId` を修正してください。
