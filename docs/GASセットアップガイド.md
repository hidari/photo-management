# Google Apps Script セットアップガイド

## 概要

Google Drive上の古い配布フォルダを自動削除するには、Google Apps Scriptのセットアップが必要です。

このガイドでは、リポジトリをクローンした後、GASプロジェクトを新規作成してデプロイするまでの完全な手順を説明します。

## 前提条件

- Node.js と pnpm がインストール済み
- Deno がインストール済み
- Google アカウントを持っている

## セットアップ手順

### 1. 依存パッケージをインストール

プロジェクトのルートディレクトリで以下を実行:

```bash
pnpm install
```

これにより、clasp、TypeScript、Biomeなどの開発ツールがインストールされます。

### 2. claspでログイン

Google Apps Scriptを操作するため、Googleアカウントで認証します:

```bash
pnpm exec clasp login
```

ブラウザが自動的に開くので、Googleアカウントでログインして認証してください。
認証が完了すると、ホームディレクトリに `.clasprc.json` が作成されます。

### 3. GASプロジェクトを新規作成

apps-scriptディレクトリに移動し、新規プロジェクトを作成します:

```bash
cd apps-script
pnpm exec clasp create --title "photo-management cleanup" --type standalone
```

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
deno task gas:setup
```

`config.ts` の設定値をPropertiesServiceに登録します。設定を変更した場合は再実行してください。

### ビルド + アップロード + 設定登録を一度に実行

```bash
deno task gas:deploy
```

上記の3つのステップ（build + push + setup）を一度に実行します。

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
