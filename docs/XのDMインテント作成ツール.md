# XのDMインテント作成ツール

各モデルのXアカウントからX（旧Twitter）のDM画面を直接開くURLを生成して`distribution.config.toml`に追記するツールです。

## 概要

このツールは、`distribution.config.toml` に記載されたモデルのSNSアカウント情報を元に、配布メッセージを含むDMインテントURLを自動生成します。生成されたURLにアクセスするだけで、メッセージが入力された状態でXのDM画面が開くため、写真配布の連絡作業を大幅に効率化できます。

## 前提条件

このツールを実行する前に、以下の準備が必要です：

1. **distribution.config.tomlの作成**: `deno task dirs` でイベントディレクトリと設定ファイルを生成済みであること
2. **配布メッセージの生成**: `deno task distribution` で各モデルの `message` フィールドが設定されていること
3. **モデルのSNSアカウント情報**: 各モデルの `sns` フィールドにXアカウントのURLまたはユーザー名が設定されていること

`message` または `sns` が未設定の場合、該当モデルはスキップされます。

## 基本的な使い方

```bash
deno task intent
```

デフォルトでは、以下の動作をします：

1. `config.ts` の `developedDirectoryBase` から最新のイベントディレクトリを自動検出
2. イベントディレクトリ内の `distribution.config.toml` を読み込み
3. 初回実行時は関連ツールを自動ダウンロード
4. 各モデルのXアカウントからユーザーIDを取得
5. DMインテントURLを生成
6. `distribution.config.toml` の各モデルに`intent_url`フィールドを追記して更新

## オプション

特定のイベントディレクトリや設定ファイルを指定したい場合は、以下のオプションが利用できます：

```bash
deno task intent --event-dir /path/to/event/dir --config /path/to/distribution.config.toml
```

### 利用可能なオプション

- `--event-dir`: イベントディレクトリのパスを指定（省略時は最新のディレクトリを自動検出）
- `--config`: 設定ファイル（TOML）のパスを指定（省略時はイベントディレクトリ内のTOMLファイルを自動検出）

## 出力形式

更新後の `distribution.config.toml` の構造例：

```toml
[[events]]
date = "20251012"
event_name = "アコスタATC"

[[events.models]]
name = "モデルA"
outreach = true
sns = "https://twitter.com/model_a"
download_url = "https://drive.google.com/..."
message = '''
モデルAさん、こんにちは！
アコスタATCお疲れ様でした！お写真を撮影させて頂きましたHidariと申します！
お写真の準備ができましたのでダウンロードURLをお送りいたします。
データの取り扱いについてテキスト（_README.txt）を同梱していますのでご確認いただけますと幸いです。

URL: https://drive.google.com/...

今後ともよろしくお願いします。
'''
intent_url = "https://twitter.com/messages/compose?recipient_id=1234567890&text=%E3%83%A2%E3%83%87%E3%83%AB..."
```

## 制限事項

### 文字数制限

URL構築時に以下の制限をチェックします。

以下の制限を超えた場合、エラーが発生します：

| 項目         | 最大長    | 理由                  |
|------------|--------|---------------------|
| イベント名      | 30文字   | メッセージの簡潔性を保つため      |
| モデル名       | 50文字   | Xのdisplay_name制限に準拠 |
| インテントURL全体 | 1800文字 | URL長制限（安全マージン込み）    |

**制限超過時の動作**:
- URL長が1800文字を超えた場合、エラーメッセージを表示して処理を中断
- エラーメッセージには、メッセージ長とエンコード後の長さが表示されます
- テンプレートを短縮するか、イベント名・モデル名を短くする必要があります

これらの制限は、XのURL仕様とユーザビリティを考慮して設定されています。

### 対応プラットフォーム

- macOS、Linux、Windows（WSL推奨）
- Puppeteerが動作する環境が必要

### ネットワーク要件

- インターネット接続が必要
- Xへのアクセスが可能である必要があります

## トラブルシューティング

### エラー: ユーザーIDが取得できません

```
❌ スキップ: ユーザーID取得に失敗しました（アカウントが存在しないか非公開の可能性があります）
```

**原因**:
- Xアカウントが存在しない、削除済み、または非公開に設定されている
- SNSフィールドのURLまたはユーザー名が間違っている
- Xのページ構造が変更された

**対処法**:
1. `distribution.config.toml` の `sns` フィールドを確認し、正しいアカウント情報を入力
2. ブラウザで該当アカウントにアクセスできるか確認
3. 該当モデルはスキップされますが、他のモデルの処理は継続されます

### エラー: インテントURLが長すぎます

```
❌ エラー: 生成されたインテントURLが長すぎます: 2150文字（最大1800文字）
   モデル: モデルA
   メッセージ長: 350文字、エンコード後: 1050文字
   テンプレートを短縮するか、イベント名・モデル名を短くしてください
```

**原因**:
- 配布メッセージが長すぎる
- イベント名やモデル名が長い
- ダウンロードURLが非常に長い

**対処法**:
1. テンプレートファイル（`templates/MODEL_OUTREACH.eta` または `templates/MODEL_FOLLOW_UP.eta`）を編集して、メッセージを短縮
2. イベント名を30文字以内、モデル名を50文字以内に収める
3. `deno task distribution` を再実行してメッセージを再生成
4. 再度 `deno task intent` を実行

### エラー: 関連ツールのインストールに失敗しました

```
❌ 関連ツールのインストールに失敗しました（終了コード: 1）
```

**原因**:
- ディスク容量不足
- ネットワーク接続の問題
- パーミッション不足

**対処法**:
1. ディスク空き容量を確認（最低200MB以上推奨）
2. インターネット接続を確認
3. `~/.cache/puppeteer` ディレクトリへの書き込み権限を確認
4. 手動でインストール: `deno run -A npm:@puppeteer/browsers install chrome@stable --path ~/.cache/puppeteer`

### エラー: messageが設定されていません

```
⚠️  スキップ: モデル「○○」のdownload_urlまたはmessageが未設定です
```

**原因**:
- `deno task distribution` を実行していない
- Google Driveへのアップロードが完了していない

**対処法**:
1. `deno task upload` でzipファイルをGoogle Driveにアップロード
2. `deno task distribution` で配布メッセージを生成
3. 再度 `deno task intent` を実行

### エラー: イベントディレクトリが見つかりませんでした

`config.ts` の `developedDirectoryBase` パスが正しいか確認してください。または、`--event-dir` オプションで明示的にパスを指定してください。

## セキュリティとプライバシー

### データの取り扱い

- このツールはローカルで動作し、外部サーバーにデータを送信しません
- XのユーザーIDはプロフィールページの公開情報から取得されます
- 生成されたインテントURLはTOMLファイルに保存されますが、実際の送信は手動で行います

### 注意事項

- DMインテントURLには配布メッセージが含まれるため、TOMLファイルの取り扱いに注意してください
- TOMLファイルは `.gitignore` に追加することを推奨します
- 大量のアカウントに対して短時間に連続してアクセスすると、Xから制限を受ける可能性があります

## 既知の制限

- Xのページ構造が変更された場合、ユーザーID取得が失敗する可能性があります
- ログインが必要なアカウント（鍵アカウントなど）のユーザーIDは取得できません
- Puppeteerの動作環境（Chrome/Chromium）が必要です

## 参考リンク

- [Puppeteer公式ドキュメント](https://pptr.dev/)
- [Eta テンプレートエンジン](https://eta.js.org/)
- [X（Twitter）のDMインテント仕様](https://developer.twitter.com/en/docs/twitter-for-websites/direct-messages/guides/web-intents)
