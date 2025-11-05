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
2. `clasp login`でGoogle認証が完了していること
3. プロジェクトのルートディレクトリに`config.ts`が作成されていること

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

  // 保持期間(日数)（オプション、デフォルト: 30日）
  distributionRetentionDays: 30,

  // ログスプレッドシートID（オプション、未設定の場合は自動作成）
  logSpreadsheetId: 'your-spreadsheet-id',
};
```

**注意**: `photoDistributionFolderId` を設定しない場合、Google Drive上で「PhotoDistribution」という名前のフォルダが検索され、見つからなければ自動作成されます。

### ステップ2: スクリプトをデプロイして設定を登録

```bash
deno task gas:deploy
```

このコマンドは以下を自動実行します:
1. TypeScriptをコンパイル
2. Google Apps Scriptへpush
3. PropertiesServiceに設定値を登録
4. 必要に応じてconfig.tsを更新（フォルダIDなど）

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

## コマンドリファレンス

### deno task gas:deploy（推奨: 初回セットアップ）

スクリプトのコンパイル、デプロイ、設定登録をすべて実行します。

```bash
deno task gas:deploy
```

**実行内容:**
1. `gas:push` を実行（TypeScriptコンパイル + clasp push）
2. `gas:setup` を実行（PropertiesService設定登録）

**使用タイミング:**
- 初回セットアップ時
- コードと設定の両方を変更した時

### deno task gas:push（コード変更時）

スクリプトのみをコンパイルしてデプロイします（設定登録は行いません）。

```bash
deno task gas:push
```

**実行内容:**
- TypeScriptをコンパイル
- clasp push --force

**使用タイミング:**
- cleanup-scheduler.ts のコード変更時
- 設定値は変更していない時

### deno task gas:setup（設定変更時 or 初回セットアップ）

PropertiesServiceに設定値を登録します。

```bash
deno task gas:setup
```

**実行内容:**
1. config.ts から設定値を読み込み
2. Google Drive で photoDistributionFolderId を検証・検索・作成
3. setup-properties.ts を生成
4. TypeScriptをコンパイル
5. clasp push --force
6. setupPropertiesFromCli() を実行してPropertiesServiceに登録
7. 必要に応じてconfig.tsを更新

**使用タイミング:**
- config.ts の設定値を変更した時
- 初回セットアップ時（gas:deploy経由で実行される）

**注意**: 内部でコンパイルとpushも実行されるため、このコマンド単体でデプロイまで完了します。

## 使用フロー

### 初回セットアップ

```bash
# 1. clasp 認証
clasp login

# 2. config.ts を作成・編集
# (cleanupNotificationEmail は必須)

# 3. デプロイと設定登録
deno task gas:deploy

# 4. Google Apps Scriptエディタでトリガー設定
# (手動操作が必要)
```

### 設定変更時

```bash
# 1. config.ts を編集

# 2. 設定を反映
deno task gas:setup
```

### コード変更時

```bash
# 1. apps-script/src/*.ts を編集

# 2. デプロイ
deno task gas:push
```

### コードと設定の両方変更時

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
  ```bash
  rm ~/.config/photo-management/google-drive-token.json
  deno task gas:setup
  ```

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

```bash
rm ~/.config/photo-management/google-drive-token.json
deno task gas:setup
```

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
