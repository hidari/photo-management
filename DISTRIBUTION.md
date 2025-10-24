# 写真管理ツール 配布版

写真家がモデルに写真を配布する際に使用するツールです。このドキュメントは、配布版（スタンドアロン実行ファイル）の使い方を説明します。

## ダウンロード

最新版は [GitHub Releases](https://github.com/hidari/photo-management/releases/latest) からダウンロードできます。

### 対応プラットフォーム

- **Windows (x64)**: `photo-manager-{VERSION}-windows-x64.exe`
- **macOS (Intel)**: `photo-manager-{VERSION}-macos-x64`
- **macOS (Apple Silicon)**: `photo-manager-{VERSION}-macos-arm64`
- **Linux (x64)**: `photo-manager-{VERSION}-linux-x64`

お使いのOSに合ったファイルをダウンロードしてください。

## インストール

### Windows

1. `photo-manager-{VERSION}-windows-x64.exe` をダウンロード
2. ダウンロードしたファイルをダブルクリックで実行
3. Windows Defenderの警告が出た場合は「詳細情報」→「実行」をクリック

### macOS

1. お使いのMacに合ったファイルをダウンロード
   - Intel Mac: `photo-manager-{VERSION}-macos-x64`
   - Apple Silicon Mac: `photo-manager-{VERSION}-macos-arm64`
2. ターミナルを開いて、ダウンロードフォルダに移動
3. 実行権限を付与:
   ```bash
   chmod +x photo-manager-{VERSION}-macos-*
   ```
4. 実行:
   ```bash
   ./photo-manager-{VERSION}-macos-*
   ```
5. 初回実行時に「開発元を確認できません」と表示された場合:
   - システム設定 → プライバシーとセキュリティ → セキュリティ
   - 「このまま開く」をクリック

### Linux

1. `photo-manager-{VERSION}-linux-x64` をダウンロード
2. ターミナルで実行権限を付与:
   ```bash
   chmod +x photo-manager-{VERSION}-linux-x64
   ```
3. 実行:
   ```bash
   ./photo-manager-{VERSION}-linux-x64
   ```

## 使い方

ツールを起動すると、対話的なメニューが表示されます。

```
========================================
     写真管理ツール
========================================

操作を選択してください:

[1] イベント初期化
    新しいイベントの設定ファイルを作成します

[2] README生成
    配布用READMEファイルを生成します

[3] ディレクトリ作成
    モデルごとの配布ディレクトリを作成します

[4] アーカイブ作成
    配布ディレクトリをZIPファイルにアーカイブします

[5] アップロード
    アーカイブをGoogle Cloud Storageにアップロードします

[6] 配布ドキュメント作成
    配布用の最終ドキュメントを生成します

[7] Intent URL生成
    LINE配信用のIntent URLを生成します

[8] 配布一括実行
    アーカイブ→アップロード→配布→Intent URLを一括実行します

[q] 終了

選択 (1-8, q):
```

### 基本的なワークフロー

1. **[1] イベント初期化**: 新しい撮影イベントの情報を入力
   - イベント日付（YYYYMMDD形式）
   - イベント名
   - モデル情報（名前、初回撮影かどうか、SNS情報）

2. **[3] ディレクトリ作成**: モデルごとの配布ディレクトリを自動生成

3. 生成されたディレクトリに写真を配置

4. **[8] 配布一括実行**: 残りの処理を一括で実行
   - ZIPアーカイブ作成
   - クラウドストレージへのアップロード
   - 配布ドキュメント生成
   - LINE配信用URL生成

## 必要な設定ファイル

ツールを使用する前に、以下の設定ファイルを用意してください:

### 1. `distribution.config.toml`

イベント初期化（メニュー[1]）で自動生成されます。

### 2. `gcs.config.toml`

Google Cloud Storage設定（アップロード機能を使う場合のみ必要）:

```toml
bucket_name = "your-bucket-name"
project_id = "your-project-id"
```

### 3. `line.config.toml`

LINE配信設定（Intent URL生成機能を使う場合のみ必要）:

```toml
base_url = "https://your-domain.com"
```

## トラブルシューティング

### Windows: 「WindowsによってPCが保護されました」と表示される

1. 「詳細情報」をクリック
2. 「実行」ボタンをクリック

### macOS: 「開発元を確認できません」と表示される

1. システム設定を開く
2. プライバシーとセキュリティ → セキュリティ
3. 「このまま開く」をクリック

### Linux: 実行できない

実行権限が付与されているか確認してください:
```bash
chmod +x photo-manager-{VERSION}-linux-x64
```

### その他の問題

問題が発生した場合は、[GitHub Issues](https://github.com/hidari/photo-management/issues) で報告してください。

## 開発者向け情報

開発環境でツールを実行したい場合は、[README.md](./README.md) を参照してください。

## ライセンス

MIT License
