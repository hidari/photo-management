# Google Apps Script 自動削除スクリプト

このディレクトリには、Google Drive上の古いイベントフォルダを自動削除するGoogle Apps Scriptが含まれています。

## ファイル構成

- `src/cleanup-scheduler.ts` - 自動削除スクリプト本体（TypeScript）
- `src/setup-properties.ts` - PropertiesService設定用スクリプト（自動生成）
- `dist/` - コンパイル後のJavaScriptファイル
- `.clasp.json` - clasp設定ファイル
- `tsconfig.json` - TypeScript設定ファイル

## セットアップ手順

### 前提条件

1. [clasp](https://github.com/google/clasp)がインストールされていること
2. `docs/GASセットアップガイド.md` の「事前準備（GCP設定）」が完了していること
3. `clasp login --creds ~/.config/photo-management/cred.json`で認証が完了していること
4. プロジェクトのルートディレクトリに`config.ts`が作成されていること

**重要**: `deno task gas:apply` コマンドで設定を自動登録するには、事前にGoogle Cloud Platform（GCP）でプロジェクト作成、API有効化、OAuth設定が必要です。詳細は `docs/GASセットアップガイド.md` を参照してください。

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
deno task gas:apply
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

**既存プロジェクトの場合**: `apps-script/appsscript.json` に `executionApi` の設定がない場合は、以下を手動で追加してください:

```json
{
  "executionApi": {
    "access": "MYSELF"
  }
}
```

この設定により、`deno task gas:apply` で設定が自動的に反映されるようになります。

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

### コード/設定の変更時

```bash
deno task gas:deploy
```

## 機能

### 自動削除

- 設定した保持期間より古いイベントフォルダを自動的に削除
- トリガーで設定した時刻に毎日実行
- 削除前の確認は不要（完全自動）

### メール通知

- 削除実行後に結果をメールで通知
- 削除されたフォルダの一覧を含む
- エラーが発生した場合も通知

### 実行ログ

- スプレッドシートに実行履歴を記録
- 実行日時、削除数、削除フォルダ名、エラー数を記録
- `logSpreadsheetId` を未設定の場合は初回実行時に自動作成

## トラブルシューティング

### "設定エラー: XXXが設定されていません"と表示される

PropertiesServiceに設定が登録されていません。以下を実行してください:

```bash
deno task gas:setup
```

### 権限エラーが発生する

- スクリプトを実行するアカウントが`photoDistributionFolder`にアクセスできることを確認
- `clasp login` で正しいアカウントで認証しているか確認
- トークンを再取得:
  - `~/.config/photo-management/` 配下の認証トークンを削除
  - `deno task gas:setup` を実行

### メール通知が届かない

- `config.ts`の`cleanupNotificationEmail`が正しく設定されているか確認
- `deno task gas:setup`を実行してPropertiesServiceを更新
- Google Apps Scriptのログで送信エラーがないか確認

### setupPropertiesFromCli が見つからない

`deno task gas:setup` を実行したが、Google Apps Scriptエディタに関数が表示されない場合:

1. 手動でデプロイを試す:
   ```bash
   cd apps-script
   npx tsc
   npx clasp push --force
   ```

2. それでも表示されない場合、`clasp login` を再実行

### フォルダIDの検証で404エラーが発生する

古いアクセストークンを使用している可能性があります:

1. `~/.config/photo-management/` 配下の認証トークンを削除
2. `deno task gas:setup` を実行

## CLI版との違い

| 機能         | Google Apps Script版 | CLI版            |
|------------|---------------------|-----------------|
| 実行方式       | 完全自動(トリガー)          | 手動実行            |
| 確認プロンプト    | なし                  | あり(--execute必要) |
| dry-runモード | testCleanup()で可能    | あり              |
| メール通知      | あり                  | なし              |
| ログ記録       | スプレッドシート            | コンソール           |
| 実行環境       | Google Cloud        | ローカル            |

## 関連コマンド

### CLI版の削除コマンド

```bash
# dry-run(削除対象を表示のみ)
deno task cleanup

# 実際に削除を実行
deno task cleanup --execute
```

### その他のGAS操作

```bash
# Google Apps Scriptから最新のコードを取得
cd apps-script && npx clasp pull

# ログを確認
cd apps-script && npx clasp logs
```

## トラブルシューティング

### clasp run で "Script function not found" エラーが出る

**症状**: `deno task gas:apply` 実行時に以下のエラーが表示される：
```
Script function not found. Please make sure script is deployed as API executable.
```

**原因**: Google Cloud Platform（GCP）の事前準備が完了していません。

**解決方法**:

#### 方法1: 事前準備を完了する（推奨）
`docs/GASセットアップガイド.md` の「事前準備（GCP設定）」セクションに従って、以下を完了してください：

1. GCPプロジェクトの作成
2. Apps Script API、Drive API、Cloud Logging API の有効化
3. OAuth同意画面の設定
4. OAuthクライアントの作成
5. `clasp login --creds ~/.config/photo-management/cred.json` での認証
6. GASプロジェクトとGCPプロジェクトの紐付け

#### 方法2: GASエディタで手動実行
事前準備が完了していない場合でも、以下の手順で設定を手動登録できます：

1. [Google Apps Script エディタ](https://script.google.com/) にアクセス
2. プロジェクトを開く
3. `setupPropertiesFromCli` 関数を選択
4. 実行ボタン（▶）をクリック
5. 初回実行時に権限承認を許可

**注意**: 手動実行の場合、次回以降も `clasp run` は使用できません。設定を変更するたびにGASエディタでの手動実行が必要になります。
