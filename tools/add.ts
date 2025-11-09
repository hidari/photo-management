#!/usr/bin/env deno run --allow-read --allow-write

/**
 * モデル追加ツール
 *
 * 既存イベントに新しいモデルを追加する
 *
 * 使い方:
 *   deno task add                                    # 最新イベントのtomlを同期（toml編集後）
 *   deno task add --dialog                           # 対話的にモデルを追加
 *   deno task add --config ./path/to/config.toml    # 特定のtomlを指定
 */

import { parse } from 'https://deno.land/std@0.208.0/flags/mod.ts';
import config from '../config.ts';
import type { EventModel } from '../types/distribution-config.ts';
import { loadTomlConfig } from './lib/config-loader.ts';
import { findTomlConfigPath } from './lib/directory-finder.ts';
import { buildDirectoryStructure } from './lib/directory-structure.ts';
import { normalizeSnsUrl } from './lib/sns-utils.ts';
import { renderTemplate } from './lib/template-renderer.ts';
import { configToToml } from './lib/toml-writer.ts';

/**
 * 標準入力から1行読み取る
 */
function readLine(message: string, defaultValue?: string): string {
  const displayMessage = defaultValue ? `${message} [${defaultValue}]` : message;
  const input = prompt(displayMessage);

  if (input === null) {
    Deno.exit(0);
  }

  return input.trim() || defaultValue || '';
}

/**
 * 対話的にモデル情報を入力
 */
function inputModelInfo(): EventModel {
  console.log();
  console.log('👤 新しいモデル情報の入力');
  console.log('-'.repeat(50));

  const modelName = readLine('📝 モデル名:');
  if (!modelName) {
    console.error('❌ モデル名は必須です');
    Deno.exit(1);
  }

  const outreachInput = readLine('🆕 初回撮影ですか? (y/n):', 'y').toLowerCase();
  const outreach = outreachInput === 'y' || outreachInput === 'yes';

  const snsInput = readLine('🔗 SNS URL (任意、スキップ可):');
  const sns = snsInput ? normalizeSnsUrl(snsInput) : undefined;

  return {
    name: modelName,
    outreach,
    sns: sns || '',
    download_url: '',
    message: '',
    intent_url: '',
    distributed: false,
  };
}

/**
 * 既存ディレクトリとtomlの差分を検出
 */
export async function detectMissingModels(
  structure: ReturnType<typeof buildDirectoryStructure>
): Promise<string[]> {
  const missing: string[] = [];

  for (const model of structure.models) {
    try {
      await Deno.stat(model.distDir);
    } catch {
      // ディレクトリが存在しない場合は不足として記録
      missing.push(model.modelName);
    }
  }

  return missing;
}

/**
 * メイン処理
 */
async function main() {
  const args = parse(Deno.args, {
    string: ['config', 'template'],
    boolean: ['dialog'],
    default: {
      template: './templates/README.eta',
      dialog: false,
    },
  });

  console.log('➕ モデル追加ツール');
  console.log('='.repeat(50));
  console.log();

  try {
    // tomlファイルのパスを取得
    let tomlPath: string;
    if (args.config) {
      tomlPath = args.config;
      console.log(`📂 設定ファイル: ${tomlPath}`);
    } else {
      console.log('🔍 最新イベントの設定ファイルを検索しています...');
      tomlPath = await findTomlConfigPath(config);
      console.log(`✅ 見つかりました: ${tomlPath}`);
    }

    // tomlファイルを読み込み
    const distributionConfig = await loadTomlConfig(tomlPath);

    if (distributionConfig.events.length === 0) {
      console.error('❌ イベント情報が見つかりません');
      Deno.exit(1);
    }

    const event = distributionConfig.events[0];

    if (args.dialog) {
      // 対話的追加モード
      console.log();
      console.log(`📅 イベント: ${event.event_name} (${event.date})`);
      console.log(`👥 現在のモデル数: ${event.models.length}人`);

      const newModel = inputModelInfo();

      // モデルを追加
      event.models.push(newModel);

      console.log();
      console.log(`✅ ${newModel.name}さん を追加しました`);
    } else {
      // 同期モード（toml編集後の差分検出）
      console.log();
      console.log(`📅 イベント: ${event.event_name} (${event.date})`);
      console.log(`👥 tomlに登録されているモデル数: ${event.models.length}人`);
    }

    // ディレクトリ構造を構築
    const structure = buildDirectoryStructure(event, config);

    // 不足しているモデルを検出
    console.log();
    console.log('🔍 ディレクトリとtomlの差分を確認しています...');
    const missingModels = await detectMissingModels(structure);

    if (missingModels.length === 0) {
      console.log('✅ すべてのモデルのディレクトリが作成済みです');
      console.log();
      return;
    }

    console.log(`📁 ${missingModels.length}人分のディレクトリを作成します:`);
    for (const modelName of missingModels) {
      console.log(`   - ${modelName}さん`);
    }

    // 不足しているディレクトリとREADMEを作成
    console.log();
    console.log('📁 ディレクトリを作成しています...');
    let createdCount = 0;

    for (const model of structure.models) {
      if (missingModels.includes(model.modelName)) {
        await Deno.mkdir(model.distDir, { recursive: true });
        await renderTemplate(args.template, config, model.readmePath);
        createdCount++;
        console.log(`✅ ${model.modelName}さん のディレクトリとREADMEを作成しました`);
      }
    }

    // tomlファイルを更新（対話的追加モードの場合のみ）
    if (args.dialog) {
      const tomlContent = configToToml(distributionConfig);
      await Deno.writeTextFile(tomlPath, tomlContent);
      console.log();
      console.log(`💾 設定ファイルを更新しました: ${tomlPath}`);
    }

    console.log();
    console.log(`🎉 完了! ${createdCount}人分のディレクトリとREADMEを作成しました`);
    console.log();
    console.log('次のステップ:');
    console.log('  1. 追加したモデルの配布用ディレクトリに写真を配置してください');
    console.log('  2. 配置後、deno task upload を実行してGoogle Driveにアップロードしてください');
  } catch (error) {
    console.error();
    if (error instanceof Deno.errors.NotFound) {
      console.error(`❌ エラー: ファイルが見つかりません`);
      console.error(`   ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`❌ エラー: ${error.message}`);
    } else {
      console.error(`❌ エラー: 予期しない問題が発生しました`);
      console.error(error);
    }

    Deno.exit(1);
  }
}

// このファイルが直接実行された場合のみ、main関数を実行する
if (import.meta.main) {
  main();
}
