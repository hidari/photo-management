#!/usr/bin/env deno run --allow-read --allow-write --allow-run

/**
 * 配布用ディレクトリアーカイブツール
 *
 * このスクリプトは、generate-directories.tsで作成したDIST_DIRをzipにまとめる
 *
 * 使い方:
 *   deno task archive                                    # 最新のイベントを自動検出
 *   deno task archive --event-dir ./path/to/event        # イベントディレクトリを指定
 *   deno task archive --config ./path/to/config.toml     # TOMLファイルを直接指定
 */

import { parse } from 'https://deno.land/std@0.208.0/flags/mod.ts';
import { basename, join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import type { Config } from 'types/config.ts';
import config from '../config.ts';
import type { DistributionConfig } from '../types/distribution-config.ts';
import { loadTomlConfig } from './lib/config-loader.ts';
import { findLatestEventDir, findTomlInEventDir } from './lib/directory-finder.ts';
import { buildDirectoryStructure } from './lib/directory-structure.ts';

/**
 * アーカイブツールのパスを解決する
 *
 * config.archiveToolが設定されている場合はそれを使用し、
 * 未設定の場合は自動的にripバイナリをセットアップする
 *
 * @param appConfig - アプリケーション設定
 * @returns アーカイブツールのフルパス
 */
export async function resolveArchiveTool(appConfig: Config): Promise<string> {
  // config.archiveToolが設定されている場合
  if (appConfig.archiveTool) {
    // 実行テストを行う
    const testProcess = new Deno.Command(appConfig.archiveTool, {
      args: ['--version'],
      stdout: 'piped',
      stderr: 'piped',
    });

    try {
      const { success } = await testProcess.output();

      if (success) {
        return appConfig.archiveTool;
      }

      throw new Error(`指定されたアーカイブツールが正常に動作しません: ${appConfig.archiveTool}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('指定されたアーカイブツール')) {
        throw error;
      }
      throw new Error(`指定されたアーカイブツールの実行に失敗しました: ${appConfig.archiveTool}`);
    }
  }

  // 未設定の場合は自動セットアップ
  console.log('🔧 アーカイブツールが未設定です。自動セットアップを開始します...');
  console.log();

  // ensure-rip-binary.tsの関数を動的にインポート
  const { ensureRipBinary } = await import('./ensure-rip-binary.ts');
  const binaryPath = await ensureRipBinary();

  console.log();

  return binaryPath;
}

// 互換性のため既存のエクスポートを維持
export { findLatestEventDir, findTomlInEventDir };

/**
 * ディレクトリ構造からDIST_DIRのパス一覧を取得する
 *
 * @param directoryConfig - TOMLから読み込んだ設定
 * @param appConfig - アプリケーション設定
 * @returns DIST_DIRのパス配列
 */
export function listDistDirectories(
  directoryConfig: DistributionConfig,
  appConfig: Config
): string[] {
  const distDirs: string[] = [];

  for (const event of directoryConfig.events) {
    const structure = buildDirectoryStructure(event, appConfig);
    for (const model of structure.models) {
      distDirs.push(model.distDir);
    }
  }

  return distDirs;
}

/**
 * ユーザーに確認プロンプトを表示する
 *
 * @param message - 表示するメッセージ
 * @returns ユーザーが'y'を入力した場合true
 */
export async function promptConfirm(message: string): Promise<boolean> {
  console.log(message);
  const buf = new Uint8Array(1024);
  const n = await Deno.stdin.read(buf);

  if (n === null) {
    return false;
  }

  const input = new TextDecoder().decode(buf.subarray(0, n)).trim().toLowerCase();
  return input === 'y' || input === 'yes';
}

/**
 * 単一のDIST_DIRをアーカイブする
 *
 * @param distDir - アーカイブするディレクトリのパス
 * @param archiveTool - 使用するアーカイブコマンド
 */
export async function createArchive(distDir: string, archiveTool: string): Promise<void> {
  const distDirName = basename(distDir);

  const process = new Deno.Command(archiveTool, {
    args: [distDirName],
    cwd: join(distDir, '..'), // 親ディレクトリで実行
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { success } = await process.output();

  if (!success) {
    throw new Error(`アーカイブの作成に失敗しました: ${distDir}`);
  }
}

/**
 * すべてのDIST_DIRをアーカイブする
 *
 * @param distDirs - アーカイブするディレクトリのパス配列
 * @param archiveTool - 使用するアーカイブコマンド
 */
export async function archiveAllDistributions(
  distDirs: string[],
  archiveTool: string
): Promise<void> {
  for (const distDir of distDirs) {
    const distDirName = basename(distDir);
    const outputPath = join(distDir, '..', `${distDirName}.zip`);

    console.log(`📦 アーカイブ作成中: ${distDirName}`);
    await createArchive(distDir, archiveTool);
    console.log(`   ✅ 完了: ${outputPath}`);
  }
}

/**
 * スクリプトエントリーポイント
 */
async function main() {
  const args = parse(Deno.args, {
    string: ['config', 'event-dir'],
  });

  console.log('📦 配布用ディレクトリアーカイブツール');
  console.log();

  // アーカイブツールのパスを解決
  let archiveTool: string;

  try {
    archiveTool = await resolveArchiveTool(config);
    console.log(`✅ アーカイブツール: ${archiveTool}`);
    console.log();
  } catch (error) {
    console.error(`❌ エラー: ${error instanceof Error ? error.message : String(error)}`);
    console.error();
    console.error(`手動インストール手順:`);
    console.error(`1. アーカイブツールをインストール`);
    console.error(`2. config.ts の archiveTool にフルパスを設定`);
    Deno.exit(1);
  }

  let tomlPath: string | null;

  // TOMLファイルのパスを決定
  if (args.config) {
    // --config が指定された場合
    tomlPath = args.config;
    console.log(`📄 指定された設定ファイル: ${tomlPath}`);
  } else if (args['event-dir']) {
    // --event-dir が指定された場合
    const eventDir = args['event-dir'];
    tomlPath = await findTomlInEventDir(eventDir);

    if (!tomlPath) {
      console.error(`❌ エラー: ${eventDir} 内にTOMLファイルが見つかりません`);
      Deno.exit(1);
    }

    console.log(`📂 指定されたイベント: ${basename(eventDir)}`);
    console.log(`📄 設定ファイル: ${basename(tomlPath)}`);
  } else {
    // 引数なし: 最新のイベントを自動検出
    console.log(`🔍 最新のイベントを検出中...`);
    const latestEventDir = await findLatestEventDir(config.developedDirectoryBase);

    if (!latestEventDir) {
      console.error(
        `❌ エラー: ${config.developedDirectoryBase} 内にイベントディレクトリが見つかりません`
      );
      Deno.exit(1);
    }

    tomlPath = await findTomlInEventDir(latestEventDir);

    if (!tomlPath) {
      console.error(`❌ エラー: ${latestEventDir} 内にTOMLファイルが見つかりません`);
      Deno.exit(1);
    }

    console.log(`   ✅ 最新のイベントを検出しました: ${basename(latestEventDir)}`);
    console.log(`   📄 設定ファイル: ${basename(tomlPath)}`);
  }

  console.log();

  try {
    // TOMLファイルを読み込む
    const directoryConfig = await loadTomlConfig(tomlPath);

    // DIST_DIRの一覧を取得
    const distDirs = listDistDirectories(directoryConfig, config);

    if (distDirs.length === 0) {
      console.error('❌ エラー: アーカイブ対象のディレクトリが見つかりません');
      Deno.exit(1);
    }

    // DIST_DIR一覧を表示
    console.log('📋 以下のディレクトリをアーカイブします:');
    for (const distDir of distDirs) {
      console.log(`   • ${basename(distDir)}`);
    }
    console.log();
    console.log(`合計: ${distDirs.length}ディレクトリ`);
    console.log();

    // 確認プロンプト
    const confirmed = await promptConfirm('このイベントをアーカイブしますか？ (y/N): ');

    if (!confirmed) {
      console.log('❌ キャンセルされました');
      Deno.exit(0);
    }

    console.log();

    // アーカイブを作成
    await archiveAllDistributions(distDirs, archiveTool);

    console.log();
    console.log('🎉 すべてのアーカイブが作成されました!');
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
