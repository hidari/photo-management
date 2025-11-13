# Google Apps Script プロジェクト

このディレクトリには、この写真管理ツール群で使用するGoogle Apps Scriptプロジェクトが含まれています。

## プロジェクト構成

### cleanup-scheduler/

古いイベントフォルダを自動削除するスクリプト

- `src/cleanup-scheduler.ts` - 自動削除スクリプト本体
- `src/setup-properties.ts` - PropertiesService設定用スクリプト（自動生成）
- `dist/` - コンパイル後のJavaScriptファイル
- `.clasp.json` - clasp設定ファイル
- `tsconfig.json` - TypeScript設定ファイル

### message-generator/

SNS投稿メッセージ生成スクリプト

- `src/message-generator.ts` - メッセージ生成スクリプト本体
- `src/setup-properties.ts` - PropertiesService設定用スクリプト（自動生成）
- `dist/` - コンパイル後のJavaScriptファイル
- `.clasp.json` - clasp設定ファイル（スプレッドシートIDを含む）
- `tsconfig.json` - TypeScript設定ファイル

## セットアップ手順

### 前提条件

1. [clasp](https://github.com/google/clasp)がインストールされていること
2. [GASセットアップガイド](../docs/GASセットアップガイド.md) の「事前準備（GCP設定）」が完了していること
3. `clasp login --creds ~/.config/photo-management/cred.json`で認証が完了していること
4. プロジェクトのルートディレクトリに `config.ts` が作成されていること

**重要**: `deno task gas:apply-*` コマンドで設定を自動登録するには、事前にGoogle Cloud Platform（GCP）でプロジェクト作成、API有効化、OAuth設定が必要です。

## cleanup-scheduler（自動削除スクリプト）のセットアップ

### ステップ1: config.tsに設定を記述

プロジェクトのルートディレクトリにある`config.ts`に以下の設定を追加します:

```typescript
export const config: Config = {
  // ... 既存の設定 ...

  // 削除通知先メールアドレス（必須）
  cleanupNotificationEmail: 'your-email@example.com',

  // 写真配布用フォルダのID（オプション、未設定の場合は自動作成）
  // Google Drive URL から /folders/ の後の文字列
  photoDistributionFolderId: 'your-folder-id-here',

  // 保持期間(日数)（オプション、デフォルト: 90日）
  distributionRetentionDays: 90,

  // ログスプレッドシートID（オプション、未設定の場合は自動作成）
  logSpreadsheetId: 'your-spreadsheet-id',
};
```

**注意**: `photoDistributionFolderId` を設定しない場合、Google Drive上で「PhotoDistribution」という名前のフォルダが検索され、見つからなければ自動作成されます。

### ステップ2: スクリプトをデプロイして設定を登録

```bash
deno task gas:apply-cleanup-scheduler
```

このコマンドは以下を自動実行します:

1. `appsscript.json`の確認と`executionApi`の追加（必要な場合）
2. `appsscript.json`を`dist/`にコピー
3. TypeScriptをコンパイル
4. Google Apps Scriptへpush
5. バージョンを作成（`clasp version`）
6. デプロイを作成（`clasp deploy`）
7. PropertiesServiceに設定値を登録
8. 必要に応じてconfig.tsを更新（フォルダIDなど）

### ステップ3: トリガーを設定

1. [Google Apps Scriptエディタ](https://script.google.com/)にアクセス
2. プロジェクトを開く
3. 左メニューから「トリガー」をクリック
4. 「トリガーを追加」をクリック
5. 以下のように設定:
   - 実行する関数: `cleanupOldEvents`
   - イベントのソース: `時間主導型`
   - 時間ベースのトリガー: `日付タイマー`
   - 時刻: `午前2時〜午前3時` (任意)
6. 「保存」をクリック

### ステップ4: テスト実行

1. Google Apps Scriptエディタで「testCleanup」を選択
2. 実行ボタン(▶)をクリック
3. 初回実行時に権限承認を許可
4. 実行ログで削除対象が正しく検出されているか確認

## message-generator（X投稿メッセージ生成スクリプト）のセットアップ

### 1. サンプルファイルを使った設定

セットアップを簡単にするため、サンプルファイルを用意しています：

📁 サンプルフォルダ: https://drive.google.com/drive/folders/1DwrIU6a0FzhWo-KmSB2Leu_uRmWUCrjs?usp=sharing

**含まれるファイル:**
- スプレッドシートテンプレート: 11列すべて定義済み、サンプルデータ入り
- POST.txtサンプル: テンプレート変数の使用例、実際に動作するテンプレート

**使い方:**
1. 上記のサンプルフォルダにアクセス
2. スプレッドシートを開き、「ファイル」→「コピーを作成」
3. POST.txt をダウンロードまたは自分のDriveにコピー
4. スプレッドシートと POST.txt のURLから `FILE_ID` を取得：
   - スプレッドシート: https://docs.google.com/spreadsheets/d/[FILE_ID]/edit
   - POST.txt: `https://drive.google.com/file/d/[FILE_ID]/view`
5. config.ts に設定を記述

   ```typescript
   export const config: Config = {
     // ... 既存の設定 ...
   
     // メッセージ生成用スプレッドシートのID（必須）
     messageGeneratorSpreadsheetId: 'your-spreadsheet-id',
   
     // SNS投稿メッセージテンプレートファイルのID（必須）
     postTemplateFileId: 'your-template-file-id',
   };
   ```

### 2. スクリプトをデプロイして設定を登録

```bash
deno task gas:apply-message-generator
```

このコマンドは以下を自動実行します:
1. スプレッドシートバインド型プロジェクトを自動作成（`clasp create --parentId`）
2. TypeScriptをコンパイル
3. Google Apps Scriptへpush
4. PropertiesServiceに設定値を登録（`POST_TEMPLATE_FILE_ID`）
5. バージョンを作成とデプロイ

### 3. 投稿メッセージの生成

1. スプレッドシートを開く
2. カスタムメニュー「メッセージ生成」が表示されることを確認
3. データを入力し、`READY`列を`TRUE`に設定
4. カスタムメニューから「メッセージ生成」を実行
5. `MESSAGE`列に生成されたメッセージが自動入力される

**自動検証機能**:
- `READY`列を編集すると、自動的にデータの整合性がチェックされます
- 必須項目（ID, FILE, PHOTO_TITLE, TITLE, CHARACTER, MODEL_NAME, MODEL_ACCOUNT）が入力されているか確認
- 必須項目が不足している場合、READYは自動的にFALSEに戻されます

## トラブルシューティング

### "設定エラー: XXXが設定されていません"と表示される

PropertiesServiceに設定が登録されていません。以下を実行してください:

```bash
# cleanup-schedulerの場合
deno task gas:apply-cleanup-scheduler

# message-generatorの場合
deno task gas:apply-message-generator
```

### 権限エラーが発生する

- スクリプトを実行するアカウントが対象リソースにアクセスできることを確認
- `clasp login` で正しいアカウントで認証しているか確認
- トークンを再取得:
  - `~/.config/photo-management/` 配下の認証トークンを削除
  - セットアップコマンドを再実行

### setupPropertiesFromCli が見つからない

セットアップコマンドを実行したが、Google Apps Scriptエディタに関数が表示されない場合:

1. 手動でデプロイを試す:
   ```bash
   # cleanup-schedulerの場合
   cd apps-script/cleanup-scheduler
   tsc
   clasp push --force

   # message-generatorの場合
   cd apps-script/message-generator
   tsc
   clasp push --force
   ```

2. それでも表示されない場合、`clasp login` を再実行

### clasp run で "Script function not found" エラーが出る

**症状**: `deno task gas:apply-*` 実行時に以下のエラーが表示される：
```
Script function not found. Please make sure script is deployed as API executable.
```

**原因**: Google Cloud Platform（GCP）の事前準備が完了していません。

**解決方法**:

#### 方法1: 事前準備を完了する（推奨）
[GASセットアップガイド](../docs/GASセットアップガイド.md) の「事前準備（GCP設定）」セクションに従って、設定を完了してください。

#### 方法2: GASエディタで手動実行
事前準備が完了していない場合でも、以下の手順で設定を手動登録できます：

1. [Google Apps Script エディタ](https://script.google.com/) にアクセス
2. プロジェクトを開く
3. `setupPropertiesFromCli` 関数を選択
4. 実行ボタン（▶）をクリック
5. 初回実行時に権限承認を許可

**注意**: 手動実行の場合、次回以降も `clasp run` は使用できません。設定を変更するたびにGASエディタでの手動実行が必要になります。

## CLIでの実行

[メンテナンスガイド](../docs/メンテナンスガイド.md) を参照してください。
