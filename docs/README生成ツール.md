# README生成ツール

テンプレートから写真配布用のREADMEを生成するツールです。

## 基本的な使い方

```bash
deno task readme
```

デフォルトでは `./Output/_README.txt` に出力されます。

## オプション

テンプレートや出力先をカスタマイズできます：

```bash
deno task readme --template ./templates/README.eta --output ./custom/path/README.txt
```

### 利用可能なオプション

- `--template`: 使用するテンプレートファイルのパス（デフォルト: `./templates/README.eta`）
- `--output`: 出力先ファイルのパス（デフォルト: `./Output/_README.txt`）

## テンプレートについて

このツールは **Eta** テンプレートエンジンを使用しています。

テンプレートファイル内では、`config.ts` で定義した設定値を使用できます。

詳細なテンプレート構文については、[Eta公式ドキュメント](https://eta.js.org/)を参照してください。

## トラブルシューティング

### config.tsが見つからない

`config.example.ts` を `config.ts` にコピーして設定を記入してください：

```bash
cp config.example.ts config.ts
```

### テンプレートファイルが見つからない

指定したテンプレートファイルのパスが正しいか確認してください。
