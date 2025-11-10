#!/usr/bin/env deno run --allow-read --allow-write

/**
 * イベント初期化ツール（統合版）
 *
 * イベント情報の入力からディレクトリ構造作成、README生成までを一括で実行する
 *
 * 使い方:
 *   deno task init                                 # 対話的にイベント情報を入力
 *   deno task init --config ./path/to/config.toml  # 既存tomlから作成
 */

import { parse } from 'https://deno.land/std@0.208.0/flags/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import config from '../config.ts';
import type { Config } from '../types/config.ts';
import type { DistributionConfig, Event, EventModel } from '../types/distribution-config.ts';
import { loadTomlConfig } from './lib/config-loader.ts';
import { buildDirectoryStructure } from './lib/directory-structure.ts';
import { normalizeSnsUrl } from './lib/sns-utils.ts';
import { renderTemplate } from './lib/template-renderer.ts';
import { configToToml } from './lib/toml-writer.ts';

/**
 * 画面をクリアする
 */
function clearScreen(): void {
  console.clear();
}

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
 * 日付のバリデーション（YYYYMMDD形式）
 */
export function validateDate(date: string): boolean {
  if (!/^\d{8}$/.test(date)) {
    return false;
  }

  const year = Number.parseInt(date.substring(0, 4), 10);
  const month = Number.parseInt(date.substring(4, 6), 10);
  const day = Number.parseInt(date.substring(6, 8), 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // 簡易的な日付チェック
  const testDate = new Date(year, month - 1, day);
  return (
    testDate.getFullYear() === year &&
    testDate.getMonth() === month - 1 &&
    testDate.getDate() === day
  );
}

/**
 * イベント情報を対話的に入力
 */
async function inputEventInfo(): Promise<Event> {
  clearScreen();
  console.log('イベント情報の入力');
  console.log('-'.repeat(50));
  console.log();

  // 日付入力
  let date = '';
  while (true) {
    date = readLine('イベント日付 (YYYYMMDD形式):');
    if (validateDate(date)) {
      break;
    }
    console.log('❌ 無効な日付形式です。YYYYMMDD形式で入力してください。');
  }

  // イベント名入力
  const eventName = readLine('イベント名:');

  // モデル情報入力
  const models: EventModel[] = [];

  console.log();
  console.log('モデル情報の入力');
  console.log('-'.repeat(50));

  while (true) {
    console.log();
    const modelName = readLine(`モデル名 (${models.length + 1}人目、空欄で終了):`);

    if (!modelName) {
      if (models.length === 0) {
        console.log('⚠️ 最低1人のモデルを登録してください。');
        continue;
      }
      break;
    }

    const outreachInput = readLine('初回撮影ですか? (y/n):', 'y').toLowerCase();
    const outreach = outreachInput === 'y' || outreachInput === 'yes';

    const snsInput = readLine('SNS URL (任意、スキップ可):');
    const sns = snsInput ? normalizeSnsUrl(snsInput) : undefined;

    models.push({
      name: modelName,
      outreach,
      sns: sns || '',
      download_url: '',
      message: '',
      intent_url: '',
      distributed: false,
    });

    console.log(`✅ ${modelName}さん を追加しました`);
  }

  return {
    date,
    event_name: eventName,
    models,
  };
}

/**
 * ディレクトリ構造を作成する
 */
async function createDirectories(
  structure: ReturnType<typeof buildDirectoryStructure>
): Promise<void> {
  // イベントディレクトリを作成
  await Deno.mkdir(structure.eventDir, { recursive: true });

  // 各モデルのディレクトリを作成
  for (const model of structure.models) {
    await Deno.mkdir(model.distDir, { recursive: true });
  }
}

/**
 * 各配布ディレクトリにREADMEファイルを生成する
 */
async function generateReadmeFiles(
  structure: ReturnType<typeof buildDirectoryStructure>,
  appConfig: Config,
  templatePath: string
): Promise<void> {
  for (const model of structure.models) {
    await renderTemplate(templatePath, appConfig, model.readmePath);
  }
}

/**
 * TOMLファイルを保存する
 */
async function saveTomlFile(
  distributionConfig: DistributionConfig,
  destPath: string
): Promise<void> {
  const tomlContent = configToToml(distributionConfig);
  await Deno.writeTextFile(destPath, tomlContent);
}

/**
 * メイン処理
 */
async function main() {
  const args = parse(Deno.args, {
    string: ['config', 'template'],
    default: {
      template: './templates/README.eta',
    },
  });

  console.log('イベント初期化ツール');
  console.log('='.repeat(50));
  console.log();

  try {
    let distributionConfig: DistributionConfig;

    if (args.config) {
      // 既存tomlファイルから読み込み
      console.log(`設定ファイルを読み込んでいます: ${args.config}`);
      distributionConfig = await loadTomlConfig(args.config);
      console.log(`✅ 読み込み完了`);
      console.log();
    } else {
      // 対話的に入力
      const event = await inputEventInfo();
      distributionConfig = { events: [event] };
    }

    // 各イベントに対して処理を実行
    for (const event of distributionConfig.events) {
      console.log();
      console.log(`イベント: ${event.event_name} (${event.date})`);
      console.log(`モデル数: ${event.models.length}人`);
      console.log();

      // ディレクトリ構造を構築
      const structure = buildDirectoryStructure(event, config);

      // ディレクトリを作成
      console.log('ディレクトリを作成しています...');
      await createDirectories(structure);
      console.log(`✅ ディレクトリ作成完了: ${structure.eventDir}`);

      // READMEファイルを生成
      console.log('READMEファイルを生成しています...');
      await generateReadmeFiles(structure, config, args.template);
      console.log(`✅ README生成完了`);

      // TOMLファイルを保存
      const tomlPath = join(structure.eventDir, 'distribution.config.toml');
      console.log('設定ファイルを保存しています...');
      await saveTomlFile(distributionConfig, tomlPath);
      console.log(`✅ 設定ファイル保存完了: ${tomlPath}`);
    }

    console.log();
    console.log('✅ すべての処理が完了しました');
    console.log();
    console.log('次のステップ:');
    console.log('  1. 各モデルの配布用ディレクトリに写真を配置してください');
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
