# photo-management

写真管理用のドキュメントやツールなどのセットを管理するリポジトリです。

## セットアップ

### 1. 設定ファイルの作成

`config.example.ts` を `config.ts` にコピーして、設定を記入してください：

```bash
cp config.example.ts config.ts
```

### 2. 設定項目の編集

`config.ts` を開き、以下の項目を設定してください：

- `administrator`: あなたの名前
- `contacts`: 連絡先となるSNSアカウント（X、Blueskyなど）
- `developedDirectoryBase`: 現像済み画像を保存するディレクトリのパス

## 基本的な使い方

### README生成

テンプレートから写真配布用のREADMEを生成します：

```bash
deno task readme
```

デフォルトでは `./Output/_README.txt` に出力されます。

オプション指定としてテンプレートや出力先をカスタマイズできます：

```bash
deno task readme --template ./templates/README.eta --output ./custom/path/README.txt
```

### イベント用ディレクトリ構造作成

イベント情報を記載したTOMLファイルから、モデルごとの配布用ディレクトリ構造を自動生成します。

1. 設定ファイルの作成
    - `directory.config.example.toml` を `directory.config.toml` にコピーして、イベント情報を記入してください：
        ```bash
        cp directory.config.example.toml directory.config.toml
        ```
2. イベント情報の編集
    - `directory.config.toml` を開き、イベント情報を記入してください：
3. ディレクトリ構造の生成
    - 以下のコマンドでディレクトリ構造を作成します：
        ```bash
         deno task dirs
        ```

各配布ディレクトリには自動的に `_README.txt` が生成され、実行後に `directory.config.toml` はイベントディレクトリ内に移動されます。

カスタム設定ファイルを使用する場合：

```bash
deno task dirs --config ./path/to/custom.toml
```
