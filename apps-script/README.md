# Google Apps Script 自動削除スクリプト

このディレクトリには、Google Drive上の古いイベントフォルダを自動削除するGoogle Apps Scriptが含まれています。

## ファイル

- `src/cleanup-scheduler.ts` - 自動削除スクリプト本体（TypeScript）
- `dist/` - コンパイル後のJavaScriptファイル
- `.clasp.json` - clasp設定ファイル
- `tsconfig.json` - TypeScript設定ファイル

## セットアップ手順

### 前提条件

1. [clasp](https://github.com/google/clasp)がインストールされていること
2. `clasp login`でGoogle認証が完了していること
3. プロジェクトのルートディレクトリに`config.ts`が作成されていること

### 1. config.tsに設定を記述

プロジェクトのルートディレクトリにある`config.ts`に以下の設定を追加します:

```typescript
export const config: Config = {
  // ... 既存の設定 ...

  // 写真配布用フォルダのID（必須）
  photoDistributionFolderId: 'your-folder-id-here',

  // 削除通知先メールアドレス（必須）
  cleanupNotificationEmail: 'your-email@example.com',

  // 保持期間(日数)（オプション、デフォルト: 30日）
  distributionRetentionDays: 30,

  // ログスプレッドシートID（オプション、未設定の場合は自動作成）
  logSpreadsheetId: 'your-spreadsheet-id', // 省略可能
};
```

**PhotoDistributionフォルダのIDの取得方法:**

1. Google Driveで写真配布用フォルダを開く
2. URLから`/folders/`の後ろの文字列をコピー
   - 例: `https://drive.google.com/drive/folders/1AbC2DeF3GhI4JkL5MnO6PqR7StU8VwX9YzA`
   - この場合、`1AbC2DeF3GhI4JkL5MnO6PqR7StU8VwX9YzA`がフォルダID

### 2. デプロイと設定の自動転送

以下のコマンドでスクリプトをデプロイし、設定値をPropertiesServiceに自動登録します:

```bash
# TypeScriptをコンパイル → clasp push → 設定値登録の一連の流れ
deno task gas:deploy
```

または個別に実行:

```bash
# スクリプトのみデプロイ
deno task gas:push

# 設定値のみ登録
deno task gas:setup
```

### 3. テスト実行

1. [Google Apps Scriptエディタ](https://script.google.com/)にアクセス
2. プロジェクトを開く
3. 関数選択ドロップダウンから「testCleanup」を選択
4. 実行ボタン(▶)をクリック
5. 初回実行時に権限の承認を求められるので承認
6. 実行ログを確認し、削除対象が正しく検出されているか確認

### 4. トリガーを設定

1. Google Apps Scriptエディタの左メニューから「トリガー」をクリック
2. 「トリガーを追加」をクリック
3. 以下のように設定:
   - 実行する関数: `cleanupOldEvents`
   - イベントのソース: `時間主導型`
   - 時間ベースのトリガー: `日タイマー`
   - 時刻: `午前2時〜午前3時` (任意の時間)
4. 「保存」をクリック

### 5. ログスプレッドシートについて

`logSpreadsheetId`を設定しなかった場合、初回実行時に自動的に新しいスプレッドシートが作成されます。
作成されたスプレッドシートのIDはPropertiesServiceに自動保存され、次回以降そのスプレッドシートが使用されます。

## 機能

### 自動削除

- 設定した保持期間より古いイベントフォルダを自動的に削除
- トリガーで設定した時刻に毎日実行
- 削除前の確認は不要(完全自動)

### メール通知

- 削除実行後に結果をメールで通知
- 削除されたフォルダの一覧を含む
- エラーが発生した場合も通知

### 実行ログ

- スプレッドシートに実行履歴を記録(オプション)
- 実行日時、削除数、削除フォルダ名、エラー数を記録

## 注意事項

- このスクリプトは完全自動で動作します
- 削除前の確認プロンプトはありません
- 削除されたフォルダはゴミ箱に移動されます(完全削除ではない)
- ゴミ箱から復元可能ですが、30日後に自動的に完全削除されます

## トラブルシューティング

### 権限エラーが発生する

- スクリプトを実行するアカウントがPhotoDistributionフォルダにアクセスできることを確認
- トリガーの実行アカウントが正しいか確認

### メール通知が届かない

- `NOTIFICATION_EMAIL`が正しく設定されているか確認
- スパムフォルダを確認

### ログが記録されない

- `LOG_SPREADSHEET_ID`が正しく設定されているか確認
- スプレッドシートへのアクセス権限を確認

## CLI版との違い

| 機能         | Google Apps Script版 | CLI版            |
|------------|---------------------|-----------------|
| 実行方式       | 完全自動(トリガー)          | 手動実行            |
| 確認プロンプト    | なし                  | あり(--execute必要) |
| dry-runモード | なし                  | あり              |
| メール通知      | あり                  | なし              |
| ログ記録       | スプレッドシート            | コンソール           |
| 実行環境       | Google Cloud        | ローカル            |

## 関連コマンド

CLI版の削除コマンド:

```bash
# dry-run(削除対象を表示のみ)
deno task cleanup

# 実際に削除を実行
deno task cleanup --execute

# 保持期間を60日に設定
deno task cleanup --execute --days 60
```
