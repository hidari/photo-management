# SNS投稿メッセージ生成システム - セットアップガイド

このドキュメントでは、Google SpreadsheetとGoogle Apps Scriptを使用した、
SNS投稿メッセージ生成システムのセットアップ手順を説明します。

## 前提条件

- Googleアカウント
- Google Drive へのアクセス
- Google Spreadsheet の基本的な操作知識
- clasp のインストールとログイン認証が完了していること
  - インストール方法とGCP設定については `apps-script/README.md` を参照
  - `clasp login --creds ~/.config/photo-management/cred.json` による認証が必要
- プロジェクトルートに `config.ts` ファイルが作成済みであること（`config.example.ts` をコピーして作成）

## セットアップ手順

### 1. スプレッドシートの準備

#### 1.1 新規スプレッドシートの作成

Google Drive上で新しいスプレッドシートを作成します。

#### 1.2 列ヘッダーの設定

1行目に以下のヘッダーを設定します：

| A  | B    | C           | D     | E         | F          | G             | H                       | I     | J       | K         |
|----|------|-------------|-------|-----------|------------|---------------|-------------------------|-------|---------|-----------|
| ID | FILE | PHOTO_TITLE | TITLE | CHARACTER | MODEL_NAME | MODEL_ACCOUNT | OPTIONAL_EVENT_HASHTAGS | READY | MESSAGE | PUBLISHED |

**各列の説明**：

- ID: 写真の識別番号（必須）
- FILE: 写真ファイル名（必須）
- PHOTO_TITLE: 写真のタイトル（必須）
- TITLE: 作品タイトル（必須）
- CHARACTER: キャラクター名（必須）
- MODEL_NAME: モデル名（必須）
- MODEL_ACCOUNT: モデルのXアカウント（@付き）（必須）
- OPTIONAL_EVENT_HASHTAGS: イベントハッシュタグ（スペース区切り）（任意）
- READY: メッセージ生成対象フラグ（TRUE/FALSE）
- MESSAGE: 生成されたメッセージ（自動入力）
- PUBLISHED: 投稿完了フラグ（TRUE/FALSE）

#### 1.3 条件付き書式の設定（推奨）

READY列（I列）に条件付き書式を設定して、必須項目が未入力の場合に警告色で表示します。

1. I列全体を選択
2. 「表示形式」→「条件付き書式」
3. 条件を追加：
   - カスタム数式: `=OR(ISBLANK($A2), ISBLANK($B2), ISBLANK($C2), ISBLANK($D2), ISBLANK($E2), ISBLANK($F2), ISBLANK($G2))`
   - 書式スタイル: 任意の警告色を設定
4. 「完了」をクリック

### 2. POST.txtテンプレートの準備

#### 2.1 テンプレートファイルの作成

スプレッドシートと同じGoogle Driveフォルダに `POST.txt` という名前のテキストファイルを作成します。

#### 2.2 テンプレート内容

以下の内容をコピー＆ペーストします：

```
CosPhoto:『 ${PHOTO_TITLE} 』

Title: ${TITLE}
Character: ${CHARACTER}

Model. ${MODEL_ACCOUNT}
Photo. Hidari
At. ${OPTIONAL_EVENT_HASHTAGS}
Discover more → #HidariPhoto
```

> プレースホルダー以外は任意に変更可能ですが、動作に支障が出た場合はコードの修正が必要になります。

**変数の説明**：
- `${PHOTO_TITLE}`: 写真のタイトルに置換されます
- `${TITLE}`: 作品タイトルに置換されます
- `${CHARACTER}`: キャラクター名に置換されます
- `${MODEL_NAME}`: モデル名に置換されます
- `${MODEL_ACCOUNT}`: モデルのXアカウントに置換されます
- `${OPTIONAL_EVENT_HASHTAGS}`: イベントハッシュタグに置換されます
  - 空の場合、`At.` で始まる行全体が削除されます

#### 2.3 ファイルIDの取得

**方法1: 共有リンクから取得**

1. POST.txtファイルを右クリック → 「共有」→ 「リンクをコピー」
2. コピーしたURLから ファイルID を抽出します
   - URL形式: `https://drive.google.com/file/d/{ファイルID}/view?usp=sharing`
   - `/d/` と `/view` の間の文字列がファイルIDです
3. ファイルIDをメモ帳などに保存しておきます

### 3. config.ts の設定

#### 3.1 スプレッドシートIDの取得

1. 作成したスプレッドシートを開く
2. ブラウザのアドレスバーからスプレッドシートIDをコピー
   - URL形式: `https://docs.google.com/spreadsheets/d/{スプレッドシートID}/edit`
   - `/d/` と `/view` の間の文字列がファイルIDです

#### 3.2 config.ts への設定追加

プロジェクトルートの `config.ts` ファイルを開き、以下の項目を設定します：

```typescript
export const config: Config = {
  // ... 他の設定項目 ...

  // メッセージ生成システム用の設定（どちらも必須）
  messageGeneratorSpreadsheetId: "{スプレッドシートID}",
  postTemplateFileId: "{POST.txtのファイルID}",
};
```

> スプレッドシートテンプレートとPOST.txtサンプルは `apps-script/README.md` に記載のGoogleドライブリンクからコピーできます。

### 4. Google Apps Script の自動セットアップ

#### 4.1 セットアップコマンドの実行

プロジェクトルートで以下のコマンドを実行します：

```bash
deno task gas:apply-message-generator
```

このコマンドは以下の処理を自動的に実行します：

1. プロジェクト作成（初回のみ）: スプレッドシートにバインドされたGASプロジェクトを作成
2. TypeScriptコンパイル: `apps-script/src/message-generator.ts` をトランスパイル
3. GASへデプロイ: コンパイル済みコードをGoogle Apps Scriptにアップロード
4. バージョン作成とデプロイ: 新しいバージョンを作成してデプロイ
5. 設定自動登録: `config.ts` の設定値をPropertiesServiceに自動登録
6. カスタムメニュー追加: スプレッドシートに「📝 メッセージ生成」メニューを追加

#### 4.2 セットアップの確認

コマンドが正常に完了したら、以下を確認します：

1. ターミナルに `✅ セットアップ完了` のメッセージが表示される
2. スプレッドシートを開くと「📝 メッセージ生成」メニューが表示される

> エラーが発生した場合は、`apps-script/README.md` のトラブルシューティングセクションを参照してください。

### 5. 動作確認

#### 5.1 カスタムメニューの確認

1. スプレッドシートのタブに戻る
2. ページを再読み込み（F5 または Ctrl/Cmd + R）
3. メニューバーに「📝 メッセージ生成」メニューが追加されていることを確認

#### 5.2 テストデータの入力

以下のようなテストデータを2行目に入力します：

| A | B        | C      | D  | E   | F      | G             | H           | I    |
|---|----------|--------|----|-----|--------|---------------|-------------|------|
| 1 | test.jpg | 作品タイトル | 原神 | ダリア | テストモデル | @test_account | #C105 #コスホリ | TRUE |

#### 5.3 メッセージ生成の実行

1. 「📝 メッセージ生成」→「メッセージを生成する」をクリック
2. 「1件のメッセージを生成しました。」というダイアログが表示されることを確認
3. J列（MESSAGE列）に生成されたメッセージが書き込まれていることを確認

## 使用方法

### メッセージ生成フロー

1. データ入力: スプレッドシートに写真情報を入力（A-H列）
2. READY設定: メッセージを生成したい行のREADY列（I列）に `TRUE` を入力
3. メッセージ生成: 「📝 メッセージ生成」→「メッセージを生成する」を実行
4. 確認: MESSAGE列（J列）に生成されたメッセージを確認
5. 投稿: MESSAGEをコピーして、Xに手動で投稿（写真も添付）
6. 完了マーク: 投稿後、PUBLISHED列（K列）に `TRUE` を入力

## トラブルシューティング

### セットアップコマンドでエラーが発生する

原因:
- clasp認証が完了していない
- GCP設定が不完全
- config.tsの設定値が間違っている

解決方法:
1. `apps-script/README.md` のトラブルシューティングセクションを参照
2. clasp認証を再実行: `clasp login --creds ~/.config/photo-management/cred.json`
3. config.tsの設定値（スプレッドシートID、ファイルID）を確認

### エラー: 「POST.txtのファイルIDが設定されていません」

原因: config.tsに `postTemplateFileId` が設定されていない

解決方法: config.tsに `postTemplateFileId` を追加して、再度 `deno task gas:apply-message-generator` を実行

### エラー: 「POST.txtファイルを読み込めませんでした」

原因:
- ファイルIDが間違っている
- POST.txtファイルが削除された
- ファイルへのアクセス権限がない

解決方法:
1. POST.txtファイルがGoogle Driveに存在するか確認
2. config.tsのファイルIDが正しいか確認
3. ファイルの共有設定を確認（自分がオーナーまたは編集権限を持っているか）

### 生成結果が0件になる

原因:
- READY列が `TRUE` になっていない
- 必須項目（A-H列）のいずれかが空白
- すでに `MESSAGE` が存在している行は無視されます

解決方法:
1. READY列（I列）に `TRUE` と入力されているか確認
2. A-H列のすべてに値が入力されているか確認
3. 条件付き書式を設定している場合、警告色になっていないか確認
4. `MESSAGE` が空になっていることを確認

### カスタムメニューが表示されない

原因: セットアップが正常に完了していない、またはスプレッドシートが更新されていない

解決方法:
1. スプレッドシートを再読み込み（F5 または Ctrl/Cmd + R）
2. `deno task gas:apply-message-generator` を再実行
3. それでも表示されない場合、`apps-script/README.md` のトラブルシューティングを参照

## よくある質問

### Q: テンプレートを変更したい

A: POST.txtファイルを編集してください。次回のメッセージ生成時から反映されます。

### Q: 複数のテンプレートを使い分けたい

A: 現在のバージョンでは1つのテンプレートのみ対応しています。将来的な拡張として検討中です。

### Q: 生成されたメッセージは上書きされますか？

A: いいえ。`MESSAGE` がすでに存在する行はスキップされます。再度メッセージ生成するには、`MESSAGE` を空にしてください。

### Q: X（Twitter）への自動投稿は可能ですか？

A: 現在のバージョンでは手動投稿のみです。将来的には自動投稿機能の追加ができたらいいなと思っています。

### Q: メッセージの文字数制限は？

A: 現在のバージョンでは文字数チェック機能はありません。Xの制限（280字）を超えないよう、手動で確認してください。
