========================================
  写真管理ツール - 配布版
========================================

このツールは、写真家がモデルに写真を配布する際に使用するツールです。

ソースコードは https://github.com/hidari/photo-management で公開しています。

## 必要な環境

このツールを使用するには Deno が必要です。

### Denoのインストール

- macOS/Linux: curl -fsSL https://deno.land/install.sh | sh
- Windows(PowerShell): irm https://deno.land/install.ps1 | iex
- Homebrew(macOS): brew install deno

インストール後、以下のコマンドでバージョンを確認できます: deno --version

詳細なインストール手順は https://deno.land/ を参照してください。

## 初回セットアップ

### 対話式セットアップ（推奨）

以下のコマンドを実行すると、対話形式で初期設定が行えます:

   deno task setup

画面の指示に従って、以下の項目を設定してください:

- administrator: あなたの名前
- contacts: 連絡先となるSNSアカウント（X、Blueskyなど）
- developedDirectoryBase: 現像済み画像を保存するディレクトリのパス
- archiveTool: 配布用zipファイルを作成するツールを指定（オプション）
- googleDrive: Google Driveアップロード機能を使用する場合は設定（OAuth 2.0認証）

設定ファイル（config.ts）は自動的に作成されます。

注意: 作成された config.ts は個人情報を含むため、公開しないでください。

### 手動セットアップ

対話式セットアップの代わりに、手動で設定ファイルを作成することもできます:

   cp config.example.ts config.ts

その後、config.ts をテキストエディタで開いて編集してください。

### Google Driveのセットアップ（オプション）

Google Driveへのアップロード機能を使用する場合は、以下のドキュメントを参照してセットアップしてください:

docs/Google Driveアップロードツール.md

## 基本的な使い方

### ワークフロー

1. イベント情報を初期化（ディレクトリ作成とREADME生成を含む）:
   deno task init

   画面の指示に従って、イベント日付、イベント名、モデル情報を入力します。
   モデルごとの配布用ディレクトリとREADMEが自動生成されます。

2. 生成されたディレクトリに写真を配置

3. モデルの追加（必要に応じて）:
   deno task add

   追加でモデルをアサインする場合に使用します。

4. アーカイブ作成とGoogle Driveアップロード:
   deno task upload

   写真をzipファイルにアーカイブし、Google Driveにアップロードします。

5. 配布メッセージ作成とDM送信URLの生成:
   deno task ship

   モデルへの配布メッセージとXのDM送信URLを自動生成します。

6. distribution.config.toml 内の intent_url のURLを開き、内容を確認してDMを送信

## 利用可能なコマンド

- セットアップ: deno task setup
- イベント初期化: deno task init
- モデル追加: deno task add
- アップロード: deno task upload
- 配布実行: deno task ship
- 古いフォルダ削除: deno task cleanup

詳細な使い方は各コマンドの実行時に表示されるヘルプや、docs/ ディレクトリ内のドキュメントを参照してください。

## Google Apps Script機能（オプション）

このツールには、Google Apps Scriptを利用した追加機能が含まれています。

### 利用可能なGAS機能

1. cleanup-scheduler（古いフォルダの自動削除）
   Google Drive上の古いイベントフォルダを自動的に削除するスクリプトです。
   保持期間（デフォルト90日）を過ぎたフォルダを検出し、削除通知メールを送信します。

2. message-generator（X用写真投稿メッセージ自動生成）
   スプレッドシートのデータからX（Twitter）投稿用のメッセージを自動生成するスクリプトです。
   写真タイトル、モデル名、アカウントなどの情報をテンプレートに基づいて整形します。

### セットアップ方法

#### 自動セットアップ（推奨）

配布版には自動セットアップツールが含まれています：

1. 依存関係のインストール（初回のみ）:
   pnpm install

2. GASスクリプトのデプロイと設定:
   deno run --allow-read --allow-run tools/setup-cleanup-scheduler.ts
   deno run --allow-read --allow-run tools/setup-message-generator.ts

注意: GASの自動セットアップには、事前にGoogle Cloud Platform（GCP）でのプロジェクト作成とOAuth設定が必要です。
詳細は apps-script/README.md または docs/GASセットアップガイド.md を参照してください。

#### 手動セットアップ

自動セットアップツールを使用せず、手動でセットアップすることもできます。
詳細な手順は以下のドキュメントを参照してください:

- apps-script/README.md
- docs/GASセットアップガイド.md

## トラブルシューティング

### deno コマンドが見つからない

Denoが正しくインストールされているか、PATHが通っているか確認してください。

### 設定ファイルのエラー

config.ts が正しく作成されているか確認してください。

### Google Drive関連のエラー

Google Cloud Projectの設定が正しく行われているか、認証情報が有効か確認してください。
詳細は docs/Google Driveアップロードツール.md を参照してください。

### その他の問題

問題が発生した場合は、以下の GitHub Issues で報告してください。

https://github.com/hidari/photo-management/issues

## 開発者向け情報

リポジトリをクローンして開発環境で作業したい場合は、[README.md](./README.md) を参照してください。

## ライセンス

MIT License
