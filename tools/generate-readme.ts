#!/usr/bin/env deno run --allow-read --allow-write

/**
 * README生成ツール
 *
 * このスクリプトは、テンプレートファイルと設定ファイルを使って
 * 撮影データ用のREADMEファイルを自動生成する
 *
 * 使い方:
 *   deno task readme
 */

import { parse } from 'https://deno.land/std@0.208.0/flags/mod.ts';
import { dirname } from 'https://deno.land/std@0.208.0/path/mod.ts';
import { Eta, EtaError } from 'https://deno.land/x/eta@v3.4.0/src/index.ts';
import config from '../config.ts';

/**
 * テンプレートをレンダリングして、結果をファイルに書き込む
 *
 * @param templatePath - テンプレートファイルのパス
 * @param data - テンプレートに渡すデータ
 * @param outputPath - 出力先ファイルのパス
 */
export async function renderTemplate(
  templatePath: string,
  // biome-ignore lint/suspicious/noExplicitAny: Etaは任意の型のデータを受け取る
  data: any,
  outputPath: string
): Promise<void> {
  // テンプレートファイルを読み込む
  const template = await Deno.readTextFile(templatePath);

  // 出力先ディレクトリが存在しない場合は作成
  const outputDir = dirname(outputPath);
  await Deno.mkdir(outputDir, { recursive: true });

  // Etaインスタンスを作成してテンプレートをレンダリング
  const eta = new Eta();
  const result = eta.renderString(template, data) as string;
  await Deno.writeTextFile(outputPath, result);

  console.log(`✅ README生成完了: ${outputPath}`);
}

/**
 * スクリプトエントリーポイント
 */
async function main() {
  const args = parse(Deno.args, {
    string: ['template', 'output'],
    default: {
      // このスクリプトはrootから `deno task` で実行されることを前提としている
      template: './templates/README.eta',
      output: './Output/_README.txt',
    },
  });

  console.log('📝 READMEを生成しています...');
  console.log(`   テンプレート: ${args.template}`);
  console.log(`   出力先: ${args.output}`);
  console.log();

  try {
    await renderTemplate(args.template, config, args.output);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // ファイルが見つからない場合
      console.error(`❌ エラー: テンプレートファイル "${args.template}" が見つかりません`);
      console.error('   ファイルのパスを確認してください');
    } else if (error instanceof EtaError) {
      // Etaのテンプレートエラーの場合
      console.error(`❌ エラー: テンプレートの処理中に問題が発生しました`);
      console.error(`   ${error.message}`);
    } else {
      // その他のエラー
      console.error(`❌ エラー: レンダリング中に予期しない問題が発生しました`);
      console.error(error);
    }

    Deno.exit(1);
  }
}

// このファイルが直接実行された場合のみ、main関数を実行する
// これにより、他のファイルからこのファイルをインポートしても、
// main関数が勝手に実行されることはない
if (import.meta.main) {
  main();
}
