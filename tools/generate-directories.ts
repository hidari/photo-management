#!/usr/bin/env deno run --allow-read --allow-write

/**
 * イベント用ディレクトリ構造作成ツール
 *
 * このスクリプトは、TOMLファイルからイベント情報を読み込み、
 * モデルごとの配布用ディレクトリ構造を自動生成する
 *
 * 使い方:
 *   deno task dirs
 *   deno task dirs --config ./path/to/config.toml
 */

import { parse } from 'https://deno.land/std@0.208.0/flags/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import { parse as parseToml } from 'https://deno.land/std@0.208.0/toml/mod.ts';
import type { Config } from 'types/config.ts';
import config from '../config.ts';
import type {
  DirectoryConfig,
  DirectoryStructure,
  Event,
  ModelDirectory,
} from '../types/directory-config.ts';
import { renderTemplate } from './generate-readme.ts';

/**
 * TOMLファイルを読み込んでパースする
 *
 * @param tomlPath - TOMLファイルのパス
 * @returns パース済みの設定オブジェクト
 */
export async function loadTomlConfig(tomlPath: string): Promise<DirectoryConfig> {
  const content = await Deno.readTextFile(tomlPath);
  const parsed = parseToml(content) as unknown as DirectoryConfig;

  // 基本的なバリデーション
  if (!parsed.events || !Array.isArray(parsed.events) || parsed.events.length === 0) {
    throw new Error('TOMLファイルにeventsが定義されていないか、空です');
  }

  return parsed;
}

/**
 * イベント情報からディレクトリ構造オブジェクトを構築する
 *
 * @param event - イベント情報
 * @param appConfig - アプリケーション設定
 * @returns ディレクトリ構造オブジェクト
 */
export function buildDirectoryStructure(event: Event, appConfig: Config): DirectoryStructure {
  const { date, event_name, models } = event;
  const baseDir = appConfig.developedDirectoryBase;
  const eventDir = join(baseDir, `${date}_${event_name}`);

  const modelDirectories: ModelDirectory[] = models.map((model) => {
    const modelDir = join(eventDir, model.name);
    const distDir = join(
      modelDir,
      `${date}_${event_name}_${appConfig.administrator}撮影_${model.name}`
    );
    const readmePath = join(distDir, '_README.txt');

    return {
      modelName: model.name,
      modelDir,
      distDir,
      readmePath,
    };
  });

  return {
    baseDir,
    eventDir,
    models: modelDirectories,
  };
}

/**
 * ディレクトリ構造を実際に作成する
 *
 * @param structure - ディレクトリ構造オブジェクト
 */
export async function createDirectories(structure: DirectoryStructure): Promise<void> {
  // イベントディレクトリを作成
  await Deno.mkdir(structure.eventDir, { recursive: true });

  // 各モデルのディレクトリを作成
  for (const model of structure.models) {
    await Deno.mkdir(model.distDir, { recursive: true });
  }
}

/**
 * 各配布ディレクトリにREADMEファイルを生成する
 *
 * @param structure - ディレクトリ構造オブジェクト
 * @param appConfig - アプリケーション設定
 * @param templatePath - テンプレートファイルのパス
 */
export async function generateReadmeFiles(
  structure: DirectoryStructure,
  appConfig: Config,
  templatePath: string
): Promise<void> {
  for (const model of structure.models) {
    await renderTemplate(templatePath, appConfig, model.readmePath);
  }
}

/**
 * TOMLファイルをイベントディレクトリに移動する
 *
 * @param tomlPath - 元のTOMLファイルのパス
 * @param destDir - 移動先ディレクトリ
 */
export async function moveTomlFile(tomlPath: string, destDir: string): Promise<void> {
  const fileName = tomlPath.split('/').pop() || 'directory.config.toml';
  const destPath = join(destDir, fileName);

  // ファイルをコピー
  await Deno.copyFile(tomlPath, destPath);

  // 元のファイルを削除
  await Deno.remove(tomlPath);
}

/**
 * スクリプトエントリーポイント
 */
async function main() {
  const args = parse(Deno.args, {
    string: ['config', 'template'],
    default: {
      config: './directory.config.toml',
      template: './templates/README.eta',
    },
  });

  console.log('📁 イベント用ディレクトリ構造を作成しています...');
  console.log(`   設定ファイル: ${args.config}`);
  console.log(`   テンプレート: ${args.template}`);
  console.log();

  try {
    // TOMLファイルを読み込む
    const directoryConfig = await loadTomlConfig(args.config);

    // 各イベントに対して処理を実行
    for (const event of directoryConfig.events) {
      console.log(`📅 イベント: ${event.event_name} (${event.date})`);

      // ディレクトリ構造を構築
      const structure = buildDirectoryStructure(event, config);

      // ディレクトリを作成
      await createDirectories(structure);
      console.log(`✅ ディレクトリ作成完了: ${structure.eventDir}`);

      // READMEファイルを生成
      await generateReadmeFiles(structure, config, args.template);
      console.log(`✅ README生成完了 (${structure.models.length}ファイル)`);

      // TOMLファイルを移動
      await moveTomlFile(args.config, structure.eventDir);
      console.log(`✅ 設定ファイル移動完了: ${structure.eventDir}`);

      console.log();
    }

    console.log('🎉 すべての処理が完了しました!');
  } catch (error) {
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
