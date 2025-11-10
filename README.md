# photo-management

写真管理用のドキュメントやツールなどのセットを管理するリポジトリです。

撮影イベントの写真をモデルに効率的に配布するためのツールを提供します。

## 配布版について

コマンドライン操作に慣れていたり、自動化に興味があるカメラマン向けに、配布用パッケージを用意しています。

必要なファイルだけまとめたZIPファイルをダウンロードして展開、Denoをインストールするだけで使用できます。詳しくは [配布版ドキュメント](DISTRIBUTION.md) をご覧ください。

- [最新版のダウンロード（GitHub Releases）](https://github.com/hidari/photo-management/releases/latest)

## クイックスタート

以下の手順で作業を行います：

```bash
# 1. 初期設定（対話式で config.ts 作成、ripバイナリ、OAuth認証）
deno task setup

# 2. イベント作成（イベント情報入力、ディレクトリ作成、README生成）
deno task init

# 3. 各モデルのディレクトリに写真を配置

# 4. Google Driveにアップロードして配布準備
deno task upload --all

# 5. モデルへDM送信
deno task ship
```

## 開発者向けセットアップ

リポジトリをクローンして開発環境で使用する場合の手順です。配布版を使う場合は読み飛ばしてください。

### 必要な環境

- Deno - メインランタイム
- pnpm - リンター/フォーマッター管理用

### Denoのインストール

**macOS / Linux:**
```bash
curl -fsSL https://deno.land/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://deno.land/install.ps1 | iex
```

**Homebrew (macOS):**
```bash
brew install deno
```

インストール後、バージョンを確認：
```bash
deno --version
```

詳細は [Deno公式サイト](https://deno.land/) を参照してください。

### pnpmのインストール

```bash
npm install -g pnpm
```

### リポジトリのセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/hidari/photo-management.git
cd photo-management

# 開発用依存関係をインストール
pnpm install

# リンター/フォーマッターを実行
pnpm run lint:fix

# テストを実行
deno task test
```

## 詳細ドキュメント

各機能の詳細な使い方は以下のドキュメントを参照してください：

### [初期設定ガイド](./docs/初期設定ガイド.md)
- `deno task setup` コマンドの詳細
- config.ts の設定
- ripバイナリのセットアップ
- Google Drive OAuth認証

### [イベント作成ガイド](./docs/イベント作成ガイド.md)
- `deno task init` - 新規イベントの作成
- `deno task add` - モデルの追加
- ディレクトリ構造の理解
- TOMLファイルの編集

### [写真配布ガイド](./docs/写真配布ガイド.md)
- `deno task upload --all` - アップロード
- `deno task ship` - 配布実行
- フォルダ共有 vs zip配布
- 配布メッセージとインテントURL
- トラブルシューティング

### [メンテナンスガイド](./docs/メンテナンスガイド.md)
- `deno task cleanup` - 古いフォルダ削除
- Google Driveのストレージ管理
- バックアップの確認

## ライセンス

このプロジェクトは [MITライセンス](./LICENSE) で公開されています。
