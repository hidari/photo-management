/**
 * テンプレートレンダリングライブラリ
 *
 * Etaテンプレートエンジンを使用したレンダリング機能を提供する
 */

import { dirname } from 'https://deno.land/std@0.208.0/path/mod.ts';
import { Eta } from 'https://deno.land/x/eta@v3.4.0/src/index.ts';

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
 * モデル用のテンプレートをレンダリングする
 *
 * @param templatePath - テンプレートファイルのパス
 * @param modelName - モデル名
 * @param eventName - イベント名
 * @param downloadUrl - ダウンロードURL
 * @returns レンダリングされたテキスト
 */
export async function renderModelTemplate(
  templatePath: string,
  modelName: string,
  eventName: string,
  downloadUrl: string
): Promise<string> {
  const template = await Deno.readTextFile(templatePath);
  const eta = new Eta();
  return eta.renderString(template, {
    modelName,
    eventName,
    downloadUrl,
  }) as string;
}
