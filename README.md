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

### オプション指定

テンプレートや出力先をカスタマイズできます：

```bash
deno task readme --template ./templates/README.eta --output ./custom/path/README.txt
```
