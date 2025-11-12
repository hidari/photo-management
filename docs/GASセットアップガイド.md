# Google Apps Script セットアップガイド

## 概要

Google Drive上の古い配布フォルダを自動削除するには、Google Apps Scriptのセットアップが必要です。

このガイドでは、用意されたスクリプトを実行可能にするため、GASプロジェクトを新規作成してデプロイするまでの完全な手順を説明します。

## 事前準備（GCP設定）

`deno task gas:apply` コマンドで設定を自動登録するには、事前にGoogle Cloud Platform（GCP）でプロジェクトとAPIの設定が必要です。

### 1. GCPプロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 画面上部の「プロジェクトを選択」→「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例: `photo-management`）
4. 「作成」をクリック

### 2. 必要なAPIを有効化

作成したプロジェクトで以下のAPIを有効化します:

1. [Apps Script API](https://console.cloud.google.com/apis/library/script.googleapis.com) にアクセス
   - 「有効にする」をクリック
2. [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) にアクセス
   - 「有効にする」をクリック
3. [Cloud Logging API](https://console.cloud.google.com/apis/library/logging.googleapis.com) にアクセス
   - 「有効にする」をクリック

### 3. OAuth同意画面を設定

1. [OAuth同意画面](https://console.cloud.google.com/apis/credentials/consent) にアクセス
2. User Type で「外部」を選択し「作成」をクリック
3. アプリ情報を入力:
   - **アプリ名**: `photo-management`
   - **ユーザーサポートメール**: 自分のメールアドレス
   - **デベロッパーの連絡先情報**: 自分のメールアドレス
4. 「保存して次へ」をクリック
5. スコープ画面はそのまま「保存して次へ」
6. テストユーザーに自分のメールアドレスを追加
7. 「保存して次へ」をクリック

### 4. OAuthクライアントを作成

1. [認証情報ページ](https://console.cloud.google.com/apis/credentials) にアクセス
2. 「認証情報を作成」→「OAuth クライアント ID」をクリック
3. アプリケーションの種類で「デスクトップアプリ」を選択
4. 名前を入力（例: `clasp-client`）
5. 「作成」をクリック
6. クライアントIDとクライアントシークレットが表示されるのでメモ
7. 「JSONをダウンロード」をクリックしてクレデンシャルファイルをダウンロード

### 5. クレデンシャルファイルを配置

ダウンロードしたJSONファイルを `~/.config/photo-management/cred.json` に配置します:

```bash
mkdir -p ~/.config/photo-management
mv ~/Downloads/client_secret_*.json ~/.config/photo-management/cred.json
```

### 6. claspで認証

作成したOAuthクライアントを使ってclaspにログインします:

```bash
pnpm exec clasp login --creds ~/.config/photo-management/cred.json
```

ブラウザが開くので、Googleアカウントでログインして権限を承認してください。

**重要**: この事前準備を完了していない場合、`deno task gas:apply` コマンドの実行時に `clasp run` が失敗します。

## 前提条件

- Node.js と pnpm がインストール済み
- Deno がインストール済み
- Google アカウントを持っている
- 上記「事前準備（GCP設定）」が完了していること

## セットアップ手順

### 1. 依存パッケージをインストール

プロジェクトのルートディレクトリで以下を実行:

```bash
pnpm install
```

これにより、clasp、TypeScript、Biomeなどの開発ツールがインストールされます。

### 2. claspの認証を確認

事前準備で `clasp login` を実行済みであることを確認します:

```bash
pnpm exec clasp login --status
```

ログイン済みの場合は、メールアドレスが表示されます。
ログインしていない場合は、「事前準備（GCP設定）」の手順6を実行してください。

### 3. GASプロジェクトを新規作成

apps-scriptディレクトリに移動し、新規プロジェクトを作成します:

```bash
cd apps-script
pnpm exec clasp create --title "photo-management cleanup" --type standalone
```

次に、作成したGASプロジェクトを、事前準備で作成したGCPプロジェクトに紐付けます:

1. [Apps Script エディタ](https://script.google.com) にアクセス
2. 作成したプロジェクトを開く
3. 左メニューの「プロジェクトの設定」（歯車アイコン）をクリック
4. 「Google Cloud Platform（GCP）プロジェクト」セクションで「プロジェクトを変更」をクリック
5. 事前準備で作成したGCPプロジェクトの番号を入力
   - プロジェクト番号は [GCP Console](https://console.cloud.google.com/) のダッシュボードで確認できます
6. 「プロジェクトを設定」をクリック

このコマンドは以下を実行します:
- Google Apps Scriptサービス側に新規プロジェクトを作成
- ローカルに `.clasp.json` を生成（新しい `scriptId` が書き込まれる）
- デフォルトの `appsscript.json` を生成（タイムゾーン、ランタイム設定など）

### 4. TypeScriptをコンパイルしてGASにデプロイ

プロジェクトルートに戻り、デプロイコマンドを実行します:

```bash
cd ..
deno task gas:push
```

このコマンドは以下を自動実行します:
1. `apps-script/src/` 内のTypeScriptファイルを `apps-script/dist/` にコンパイル
2. コンパイルされたJavaScriptファイルをGASプロジェクトにアップロード

### 5. GASに設定を登録

PropertiesServiceに設定値を登録します:

```bash
deno task gas:setup
```

このコマンドは、`config.ts` の設定値（フォルダID、保持日数、通知先メールアドレスなど）をGASのPropertiesServiceに登録します。

**前提**: `config.ts` が作成されていること（`deno task setup` で作成できます）

### 6. 動作をテストする

GASエディタでスクリプトの動作を確認します:

```bash
# GASエディタを開く
deno task gas:open
```

または直接ブラウザで [Google Apps Script](https://script.google.com) にアクセスします。

**テスト手順**:
1. GASエディタで `cleanup-scheduler.gs` を開く
2. 実行する関数として `cleanupOldEvents` を選択
3. 「実行」ボタンをクリック
4. 初回実行時は権限の承認が求められるので、承認する
5. ログを確認して正常に動作することを確認

### 7. トリガーを設定（定期実行）

スクリプトを定期的に自動実行するため、トリガーを設定します:

1. GASエディタの左メニューから「トリガー」（時計アイコン）をクリック
2. 右下の「トリガーを追加」ボタンをクリック
3. 以下のように設定:
   - **実行する関数を選択**: `cleanupOldEvents`
   - **イベントのソースを選択**: `時間主導型`
   - **時間ベースのトリガーのタイプを選択**: `日付タイマー`
   - **時刻を選択**: `午前2時〜午前3時`（推奨、任意の時刻でOK）
4. 「保存」をクリック

これで、毎日指定した時刻に自動的にクリーンアップスクリプトが実行されます。

## よく使うコマンド

開発用のコマンドはプロジェクトルートから実行します。

### TypeScriptをビルド

```bash
deno task gas:build
```

`apps-script/src/` 内のTypeScriptを `apps-script/dist/` にコンパイルします。

### GASプロジェクトにアップロード

```bash
deno task gas:push
```

コンパイル済みのJavaScriptファイルをGASプロジェクトにアップロードします。

### GASエディタを開く

```bash
deno task gas:open
```

ブラウザでGASエディタを開きます。

### 設定をGASに登録

```bash
deno task gas:apply
```

`config.ts` の設定値をPropertiesServiceに登録します。設定を変更した場合は再実行してください。
このコマンドはTypeScriptコンパイル、clasp push、設定登録を一度に実行します。

## トラブルシューティング

### 認証エラーが出る場合

一度ログアウトしてから再度ログインしてください:

```bash
pnpm exec clasp logout
pnpm exec clasp login
```

### `clasp create` で既に `.clasp.json` が存在すると言われる

既存の `.clasp.json` を削除してから再実行してください:

```bash
cd apps-script
rm .clasp.json
pnpm exec clasp create --title "photo-management cleanup" --type standalone
```

### `deno task gas:push` でエラーが出る

以下を確認してください:

1. `.clasp.json` が存在するか確認:
   ```bash
   ls apps-script/.clasp.json
   ```

2. TypeScriptのコンパイルエラーがないか確認:
   ```bash
   cd apps-script
   npx tsc
   ```

3. dist/ ディレクトリにファイルが生成されているか確認:
   ```bash
   ls apps-script/dist/
   ```

### `deno task gas:setup` でエラーが出る

以下を確認してください:

1. `config.ts` が作成されているか:
   ```bash
   ls config.ts
   ```
   作成されていない場合は `deno task setup` を実行

2. `config.ts` に `cleanupNotificationEmail` が設定されているか:
   ```typescript
   export const config = {
     // ...
     cleanupNotificationEmail: "your-email@example.com",  // ← 設定されているか確認
   };
   ```

3. `.clasp.json` に `scriptId` が設定されているか:
   ```bash
   cat apps-script/.clasp.json
   ```

### GASエディタでの初回実行時に権限エラーが出る

初回実行時は、以下の権限を承認する必要があります:

1. 「承認が必要」ダイアログが表示されたら「権限を確認」をクリック
2. Googleアカウントを選択
3. 「詳細」→「プロジェクト名（安全ではないページ）に移動」をクリック
4. 必要な権限（Google Driveへのアクセスなど）を確認して「許可」をクリック

これは、スクリプトがGoogle Driveのフォルダを操作するために必要な権限です。

### トリガーが実行されない

以下を確認してください:

1. トリガーが正しく設定されているか（GASエディタの「トリガー」メニューで確認）
2. PropertiesServiceに設定が正しく登録されているか（`deno task gas:setup` を再実行）
3. GASエディタの「実行数」メニューで実行履歴とエラーログを確認

## 参考リンク

- [clasp公式ドキュメント](https://github.com/google/clasp)
- [Google Apps Script API リファレンス](https://developers.google.com/apps-script/reference)
- [Google Apps Script トリガーの設定](https://developers.google.com/apps-script/guides/triggers)
