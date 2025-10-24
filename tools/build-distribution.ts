#!/usr/bin/env deno run --allow-read --allow-write

/**
 * 撮影データ配布用テキスト生成ツール
 *
 * このスクリプトは、イベントディレクトリのdistribution.config.tomlを参照して
 * 各モデルへのダウンロードURLを含む連絡文を生成し、TOMLファイルに追記する
 *
 * 使い方:
 *   deno task distribution
 */

import { parse as parseFlags } from 'https://deno.land/std@0.208.0/flags/mod.ts';
import { Eta } from 'https://deno.land/x/eta@v3.4.0/src/index.ts';
import config from '../config.ts';
import type { DistributionConfig } from '../types/distribution-config.ts';
import { loadTomlConfig } from './lib/config-loader.ts';
import { findLatestEventDir, findTomlInEventDir } from './lib/directory-finder.ts';
import { configToToml } from './lib/toml-writer.ts';

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
 * TOMLファイルに配布メッセージを追記する
 *
 * @param tomlPath - TOMLファイルのパス
 * @param directoryConfig - ディレクトリ設定
 */
export async function updateTomlWithMessages(
  tomlPath: string,
  directoryConfig: DistributionConfig
): Promise<void> {
  // 各モデルのメッセージを生成
  let skippedCount = 0;
  for (const event of directoryConfig.events) {
    for (const model of event.models) {
      // download_urlが存在しない場合はスキップ
      if (!model.download_url) {
        console.warn(`   ⚠️  スキップ: モデル「${model.name}」のdownload_urlが未設定です`);
        skippedCount++;
        continue;
      }

      // outreachフィールドに応じてテンプレートを選択
      const templatePath = model.outreach
        ? './templates/MODEL_OUTREACH.eta'
        : './templates/MODEL_FOLLOW_UP.eta';

      // テンプレートをレンダリング
      // messageフィールドに設定
      model.message = await renderModelTemplate(
        templatePath,
        model.name,
        event.event_name,
        model.download_url
      );
    }
  }

  // スキップした場合は情報メッセージを追加
  if (skippedCount > 0) {
    console.log(`\n   💡 download_urlが未設定のモデル${skippedCount}件をスキップしました`);
    console.log(`   先に「deno task upload」を実行してからもう一度お試しください\n`);
  }

  // TOMLファイルに書き込み
  const tomlContent = configToToml(directoryConfig);
  await Deno.writeTextFile(tomlPath, tomlContent);
}

/**
 * スクリプトエントリーポイント
 */
async function main() {
  const args = parseFlags(Deno.args, {
    string: ['event-dir', 'config'],
  });

  console.log('📝 撮影データ配布用メッセージをTOMLファイルに追記しています...');
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

    // 配布メッセージを生成してTOMLファイルに追記
    await updateTomlWithMessages(tomlPath, directoryConfig);

    console.log();
    console.log(`✅ 配布メッセージをTOMLファイルに追記しました: ${tomlPath}`);
    console.log(
      `   更新されたモデル数: ${directoryConfig.events.reduce((acc, event) => acc + event.models.length, 0)}`
    );
  } catch (error) {
    console.error('❌ エラー:', error instanceof Error ? error.message : error);
    Deno.exit(1);
  }
}

// このファイルが直接実行された場合のみ、main関数を実行する
if (import.meta.main) {
  main();
}
