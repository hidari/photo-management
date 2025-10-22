#!/usr/bin/env deno run --allow-read --allow-write

/**
 * 撮影データ配布用テキスト生成ツール
 *
 * このスクリプトは、イベントディレクトリのdirectory.config.tomlを参照して
 * 各モデルへのダウンロードURLを含む連絡文を生成する
 *
 * 使い方:
 *   deno task distribution
 */

import { parse as parseFlags } from 'https://deno.land/std@0.208.0/flags/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import { Eta } from 'https://deno.land/x/eta@v3.4.0/src/index.ts';
import config from '../config.ts';
import type { DirectoryConfig } from '../types/directory-config.ts';
import { loadTomlConfig } from './lib/config-loader.ts';
import { findLatestEventDir, findTomlInEventDir } from './lib/directory-finder.ts';

/**
 * モデルへの配布メッセージ情報
 */
interface DistributionMessage {
  modelName: string;
  sns: string;
  text: string;
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

/**
 * 配布メッセージ一覧を生成する
 *
 * @param messages - 配布メッセージ情報の配列
 * @param outputPath - 出力先ファイルパス
 */
export async function generateDistributionMessages(
  messages: DistributionMessage[],
  outputPath: string
): Promise<void> {
  const templatePath = './templates/DISTRIBUTION_MESSAGES.eta';
  const template = await Deno.readTextFile(templatePath);
  const eta = new Eta();
  const result = eta.renderString(template, { messages }) as string;
  await Deno.writeTextFile(outputPath, result);
}

/**
 * イベントの配布メッセージを構築する
 *
 * @param directoryConfig - ディレクトリ設定
 * @returns 配布メッセージ情報の配列
 */
export async function buildDistributionMessagesForEvent(
  directoryConfig: DirectoryConfig
): Promise<DistributionMessage[]> {
  const messages: DistributionMessage[] = [];

  for (const event of directoryConfig.events) {
    for (const model of event.models) {
      // download_urlが存在しない場合はエラー
      if (!model.download_url) {
        throw new Error(
          `モデル「${model.name}」のdownload_urlが設定されていません。先にdeno task uploadを実行してください。`
        );
      }

      // outreachフィールドに応じてテンプレートを選択
      const templatePath = model.outreach
        ? './templates/MODEL_OUTREACH.eta'
        : './templates/MODEL_FOLLOW_UP.eta';

      // テンプレートをレンダリング
      const text = await renderModelTemplate(
        templatePath,
        model.name,
        event.event_name,
        model.download_url
      );

      messages.push({
        modelName: model.name,
        sns: model.sns || '',
        text: text.trim(),
      });
    }
  }

  return messages;
}

/**
 * スクリプトエントリーポイント
 */
async function main() {
  const args = parseFlags(Deno.args, {
    string: ['event-dir', 'config'],
  });

  console.log('📝 撮影データ配布用テキストを生成しています...');
  console.log();

  try {
    let eventDir: string | null = null;
    let tomlPath: string | null = null;

    // イベントディレクトリを特定
    if (args['event-dir']) {
      eventDir = args['event-dir'];
      console.log(`   イベントディレクトリ（指定）: ${eventDir}`);
    } else {
      eventDir = await findLatestEventDir(config.developedDirectoryBase);
      if (!eventDir) {
        throw new Error(
          `イベントディレクトリが見つかりませんでした: ${config.developedDirectoryBase}`
        );
      }
      console.log(`   イベントディレクトリ（自動検出）: ${eventDir}`);
    }

    // TOMLファイルを特定
    if (args.config) {
      tomlPath = args.config;
      console.log(`   設定ファイル（指定）: ${tomlPath}`);
    } else {
      tomlPath = await findTomlInEventDir(eventDir);
      if (!tomlPath) {
        throw new Error(`TOMLファイルが見つかりませんでした: ${eventDir}`);
      }
      console.log(`   設定ファイル（自動検出）: ${tomlPath}`);
    }

    // TOMLファイルを読み込み
    const directoryConfig = await loadTomlConfig(tomlPath);

    // 配布メッセージを構築
    const messages = await buildDistributionMessagesForEvent(directoryConfig);

    // 出力先パスを生成
    const outputPath = join(eventDir, 'distribution_messages.md');

    // 配布メッセージ一覧を生成
    await generateDistributionMessages(messages, outputPath);

    console.log();
    console.log(`✅ 配布メッセージ生成完了: ${outputPath}`);
    console.log(`   生成されたメッセージ数: ${messages.length}`);
  } catch (error) {
    console.error('❌ エラー:', error instanceof Error ? error.message : error);
    Deno.exit(1);
  }
}

// このファイルが直接実行された場合のみ、main関数を実行する
if (import.meta.main) {
  main();
}
