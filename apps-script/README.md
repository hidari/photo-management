# Google Apps Script 自動削除スクリプト

このディレクトリには、Google Drive上の古いイベントフォルダを自動削除するGoogle Apps Scriptが含まれています。

## ファイル

- `cleanup-scheduler.gs` - 自動削除スクリプト本体

## セットアップ手順

### 1. Google Apps Scriptプロジェクトを作成

1. [Google Apps Script](https://script.google.com/)にアクセス
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を「PhotoDistribution Cleanup」などに変更

### 2. スクリプトをコピー

1. `cleanup-scheduler.gs`の内容をコピー
2. Google Apps Scriptエディタに貼り付け

### 3. 設定を編集

スクリプトの上部にある設定セクションを編集します:

```javascript
// PhotoDistributionフォルダのID
const PHOTO_DISTRIBUTION_FOLDER_ID = 'YOUR_FOLDER_ID_HERE';

// 保持期間(日数)
const RETENTION_DAYS = 30;

// 通知先メールアドレス
const NOTIFICATION_EMAIL = 'your-email@example.com';

// 実行ログを記録するスプレッドシートのID（オプション）
const LOG_SPREADSHEET_ID = '';
```

**PhotoDistributionフォルダのIDの取得方法:**

1. Google Driveで「PhotoDistribution」フォルダを開く
2. URLから`/folders/`の後ろの文字列をコピー
   - 例: `https://drive.google.com/drive/folders/1AbC2DeF3GhI4JkL5MnO6PqR7StU8VwX9YzA`
   - この場合、`1AbC2DeF3GhI4JkL5MnO6PqR7StU8VwX9YzA`がフォルダID

### 4. テスト実行

1. 関数選択ドロップダウンから「testCleanup」を選択
2. 実行ボタン(▶)をクリック
3. 初回実行時に権限の承認を求められるので承認
4. 実行ログを確認し、削除対象が正しく検出されているか確認

### 5. トリガーを設定

1. 左メニューから「トリガー」をクリック
2. 「トリガーを追加」をクリック
3. 以下のように設定:
   - 実行する関数: `cleanupOldEvents`
   - イベントのソース: `時間主導型`
   - 時間ベースのトリガー: `日タイマー`
   - 時刻: `午前2時〜午前3時` (任意の時間)
4. 「保存」をクリック

### 6. ログ記録の設定(オプション)

実行ログをスプレッドシートに記録したい場合:

1. 新しいGoogleスプレッドシートを作成
2. スプレッドシートのURLからIDを取得
   - 例: `https://docs.google.com/spreadsheets/d/1AbC2DeF3GhI4JkL5MnO6PqR7StU8VwX9YzA/edit`
   - この場合、`1AbC2DeF3GhI4JkL5MnO6PqR7StU8VwX9YzA`がスプレッドシートID
3. スクリプトの`LOG_SPREADSHEET_ID`にIDを設定

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

| 機能 | Google Apps Script版 | CLI版 |
|------|---------------------|-------|
| 実行方式 | 完全自動(トリガー) | 手動実行 |
| 確認プロンプト | なし | あり(--execute必要) |
| dry-runモード | なし | あり |
| メール通知 | あり | なし |
| ログ記録 | スプレッドシート | コンソール |
| 実行環境 | Google Cloud | ローカル |

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
