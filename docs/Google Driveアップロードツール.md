# Google Driveアップロードツール (zip配布方式)

> **Note**: このツールはzip配布方式です。フォルダ共有方式を使用する場合は [Google Driveフォルダ共有アップロードツール](./Google%20Driveフォルダ共有アップロードツール.md) を参照してください。

作成したzipファイルをGoogle Driveにアップロードし、共有URLをTOMLファイルに記録するツールです。

## 初回セットアップ

⚠️ **重要**: 各ユーザーが自分の Google アカウントで OAuth 2.0 認証を設定してください。

このツールは gcloud CLI などの追加ツールを必要とせず、ブラウザで Google にログインするだけで使用できます。

### 1. Google Cloud Console での設定

[Google Cloud Console](https://console.cloud.google.com/) にアクセスします。

#### ステップ 1: プロジェクトの作成

1. 画面上部のプロジェクト選択ドロップダウンから「新しいプロジェクト」を選択
2. プロジェクト名を入力（例: `photo-management`）
3. 「作成」をクリック

#### ステップ 2: Google Drive API の有効化

1. 作成したプロジェクトを選択
2. 左側メニューから「APIとサービス」→「ライブラリ」を開く
3. 「Google Drive API」を検索
4. 「有効にする」をクリック

#### ステップ 3: OAuth 同意画面の設定

1. 左側メニューから「APIとサービス」→「OAuth 同意画面」を開く
2. **User Type: 「外部」を選択** してから「作成」をクリック

   > **なぜ「外部」？**
   > 「内部」は Google Workspace 組織が必要です。個人の @gmail.com アカウントでは「外部」を選択します。
   > テストモードで十分機能し、Google の審査は不要です。

3. アプリ情報を入力:
   - **アプリ名**: 任意の名前（例: `Photo Management Tool`）
   - **ユーザーサポートメール**: 自分のメールアドレス
   - **デベロッパーの連絡先情報**: 自分のメールアドレス
4. 「保存して次へ」をクリック

5. スコープの設定:
   - 「スコープを追加または削除」をクリック
   - `https://www.googleapis.com/auth/drive.file` を検索して追加

   > **最小権限スコープ**
   > `drive.file` スコープは、このアプリが作成したファイルのみにアクセスを制限します。
   > 既存の Google Drive ファイルには一切アクセスできません。

6. 「保存して次へ」をクリック

7. テストユーザーの追加:
   - 「テストユーザーを追加」をクリック
   - **自分の Google アカウント**（メールアドレス）を追加
   - 「保存して次へ」をクリック

8. 概要を確認して「ダッシュボードに戻る」をクリック

#### ステップ 4: OAuth クライアント ID の作成

1. 左側メニューから「APIとサービス」→「認証情報」を開く
2. 「認証情報を作成」→「OAuth クライアント ID」をクリック
3. アプリケーションの種類: **「デスクトップアプリ」を選択**

   > **デスクトップアプリ型の安全性**
   > デスクトップアプリ型の OAuth クライアントは、Client Secret が公開されても安全な設計です。
   > 毎回ユーザーが明示的にブラウザで同意する必要があり、
   > アクセストークンはユーザーの PC にのみ保存されます。

4. 名前を入力（例: `Photo Management CLI`）
5. 「作成」をクリック
6. 表示された **Client ID** と **Client Secret** をコピーしてメモ

### 2. 設定ファイルの編集

`config.ts` に OAuth 2.0 クライアント情報を追加：

```typescript
export default {
  // 既存の設定...

  googleDrive: {
    clientId: 'your-client-id.apps.googleusercontent.com', // ステップ4でコピーしたClient ID
    clientSecret: 'your-client-secret', // ステップ4でコピーしたClient Secret
  },
} satisfies Config;
```

**注意**: `config.ts` は `.gitignore` に含まれており、Git にコミットされません。

### 3. 初回認証

設定が完了したら、初回実行時に自動的にブラウザが開き、Google アカウントでの認証を求められます：

```bash
deno task upload
```

**認証フロー**:
1. ツールがローカルサーバー（http://localhost:8080）を起動
2. ブラウザが自動的に開き、Google ログイン画面が表示される
3. Google アカウントでログイン
4. 「このアプリは確認されていません」と表示された場合:
   - 「詳細」をクリック
   - 「（アプリ名）に移動（安全ではないページ）」をクリック

   > これは正常な動作です。テストモードのアプリのため、この警告が表示されます。

5. 権限の確認画面で「許可」をクリック
6. 「認証成功！」と表示されたらブラウザを閉じる
7. ターミナルに戻り、アップロードが開始される

**2回目以降**: ブラウザを開かずに自動的に認証されます（トークンがローカルに保存されているため）。

## アップロードの実行

```bash
# 最新のイベントを自動検出してアップロード
deno task upload

# イベントディレクトリを指定
deno task upload --event-dir ./path/to/20251012_アコスタATC

# TOMLファイルを直接指定
deno task upload --config ./path/to/distribution.config.toml

# アップロード後にローカルのzipファイルを削除
deno task upload --delete-after-upload
```

## 実行内容

スクリプトは以下の動作をします：

1. OAuth 2.0 認証を確認（必要に応じてブラウザで認証）
2. 認証されている Google アカウントを表示
3. Google Drive 上に「PhotoDistribution」フォルダを自動作成（初回のみ）
4. イベント別のフォルダを作成し、zipファイルをアップロード
5. 各ファイルの共有リンク（ダイレクトダウンロード形式）を取得
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

### 認証エラーが発生する

```
❌ エラー: Google Drive認証に失敗しました
```

**対処法**: 以下を確認してください：

1. `config.ts` の `googleDrive.clientId` と `clientSecret` が正しく設定されているか
2. Google Cloud Console で OAuth 同意画面のテストユーザーに自分のアカウントが追加されているか
3. 保存されているトークンが古い可能性があります。以下のファイルを削除して再認証：
   ```bash
   rm ~/.config/photo-management/google-drive-token.json
   deno task upload
   ```

### 「このアプリは確認されていません」と表示される

これは正常な動作です。テストモードの OAuth アプリのため、この警告が表示されます。

**対処法**:
1. 「詳細」をクリック
2. 「（アプリ名）に移動（安全ではないページ）」をクリック
3. 自分で作成したアプリなので安全です

### 他のプロジェクトと認証が競合する

このツールは OAuth 2.0 を使用しているため、**他の Google Cloud プロジェクトと競合しません**。

従来の `gcloud auth application-default` による Application Default Credentials (ADC) は使用していないため、複数のプロジェクトで作業していても問題ありません。

### APIクォータエラーが発生する

```
❌ エラー: APIクォータを超過しました
```

Google Cloud Console でクォータを確認してください：

`https://console.cloud.google.com/apis/api/drive.googleapis.com/quotas?project=YOUR_PROJECT_ID`

個人利用の範囲内であれば、クォータを超えることはほとんどありません。

## セキュリティについて

### Client ID と Client Secret は公開されても安全？

**はい、デスクトップアプリ型の OAuth クライアントは公開されても安全です。**

理由：
1. **ユーザーの明示的な同意が必要**: 毎回ブラウザで認証画面が表示され、ユーザーが「許可」をクリックしない限りアクセスできません
2. **アクセストークンはローカルに保存**: 認証情報は各ユーザーの PC にのみ保存され、外部には送信されません
3. **最小権限スコープ**: `drive.file` スコープにより、このアプリが作成したファイルのみにアクセスを制限

同様のアプローチは以下のツールでも採用されています：
- GitHub CLI (`gh` コマンド)
- Google Drive Desktop Client
- AWS CLI

### より高いセキュリティが必要な場合

独自の OAuth クライアントを作成することで、完全に独立した認証環境を構築できます（既にこのドキュメントの手順で実現されています）。
