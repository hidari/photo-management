========================================
  写真管理ツール - 配布版
========================================

このツールは、写真家がモデルに写真を配布する際に使用するツールです。

## 必要な環境

このツールを使用するには Deno が必要です。

### Denoのインストール

- macOS/Linux: curl -fsSL https://deno.land/install.sh | sh
- Windows(PowerShell): irm https://deno.land/install.ps1 | iex
- Homebrew(macOS): brew install deno

インストール後、以下のコマンドでバージョンを確認できます: deno --version

詳細なインストール手順は https://deno.land/ を参照してください。

## 初回セットアップ

### 1. 設定ファイルの作成

config.example.ts を config.ts にコピーして、設定を記入してください:

   cp config.example.ts config.ts

### 2. 設定項目の編集

config.ts を開き、以下の項目を設定してください:

- administrator: あなたの名前
- contacts: 連絡先となるSNSアカウント（X、Blueskyなど）
- developedDirectoryBase: 現像済み画像を保存するディレクトリのパス
- archiveTool: 配布用zipファイルを作成するツールを指定（オプション）
- googleDrive: Google Driveアップロード機能を使用する場合は設定（OAuth 2.0認証）

**注意**: このファイルは公開しないでください。

### 3. Google Driveのセットアップ（オプション）

Google Driveへのアップロード機能を使用する場合は、以下のドキュメントを参照してセットアップしてください:

docs/Google Driveアップロードツール.md

## 基本的な使い方

### ワークフロー

1. イベント情報を初期化:
   deno task init

2. ディレクトリ構造を作成:
   deno task dirs

3. 生成されたディレクトリに写真を配置

4. 配布準備を一括実行:
   deno task ship

5. distribution.config.toml 内の intent_url のURLを開き、DMを送信

### 個別実行する場合

4の一括実行の代わりに、以下を順に実行できます:

deno task archive      # zipファイルを作成
deno task upload       # Google Driveにアップロード
deno task distribution # 配布用メッセージ作成
deno task intent       # XのDM送信URLを作成

## 利用可能なコマンド

- イベント初期化: deno task init
- README生成: deno task readme
- ディレクトリ作成: deno task dirs
- アーカイブ作成: deno task archive
- Google Driveアップロード: deno task upload
- 配布ドキュメント作成: deno task distribution
- X用DMのURL生成: deno task intent
- 配布一括実行: deno task ship

## トラブルシューティング

### コマンドが見つからない

Denoが正しくインストールされているか、PATHが通っているか確認してください。

### 設定ファイルのエラー

config.ts が正しく作成されているか確認してください。

## 詳細なドキュメント

詳しい使い方は以下のドキュメントを参照してください:

https://github.com/hidari/photo-management/blob/main/DISTRIBUTION.md

## ライセンス

MIT License
