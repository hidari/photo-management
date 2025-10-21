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
import type { DirectoryConfig } from '../types/directory-config.ts';
import { buildDirectoryStructure, loadTomlConfig } from './generate-directories.ts';

/**
 * アーカイブツールが実行可能かチェックする
 *
 * @param toolCommand - チェックするコマンド名
 * @returns 実行可能な場合true
 */
export async function checkArchiveTool(toolCommand: string): Promise<boolean> {
  try {
    const process = new Deno.Command('which', {
      args: [toolCommand],
      stdout: 'piped',
      stderr: 'piped',
    });
    const { success } = await process.output();
    return success;
  } catch {
    return false;
  }
}

/**
 * 指定されたベースディレクトリ内で最新のイベントディレクトリを見つける
 *
 * @param baseDir - 検索対象のベースディレクトリ
 * @returns 最新のイベントディレクトリのパス（見つからない場合はnull）
 */
export async function findLatestEventDir(baseDir: string): Promise<string | null> {
  try {
    const entries: { path: string; mtime: Date | null }[] = [];

    for await (const entry of Deno.readDir(baseDir)) {
      if (entry.isDirectory) {
        const fullPath = join(baseDir, entry.name);
        const stat = await Deno.stat(fullPath);
        entries.push({ path: fullPath, mtime: stat.mtime });
      }
    }

    if (entries.length === 0) {
      return null;
    }

    // mtimeでソートして最新のものを返す
    entries.sort((a, b) => {
      if (!a.mtime || !b.mtime) return 0;
      return b.mtime.getTime() - a.mtime.getTime();
    });

    return entries[0].path;
  } catch {
    return null;
  }
}

/**
 * イベントディレクトリ内のTOMLファイルを探す
 *
 * @param eventDir - イベントディレクトリのパス
 * @returns 見つかったTOMLファイルのパス（見つからない場合はnull）
 */
export async function findTomlInEventDir(eventDir: string): Promise<string | null> {
  try {
    for await (const entry of Deno.readDir(eventDir)) {
      if (entry.isFile && entry.name.endsWith('.toml')) {
        return join(eventDir, entry.name);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * ディレクトリ構造からDIST_DIRのパス一覧を取得する
 *
 * @param directoryConfig - TOMLから読み込んだ設定
 * @param appConfig - アプリケーション設定
 * @returns DIST_DIRのパス配列
 */
export function listDistDirectories(directoryConfig: DirectoryConfig, appConfig: Config): string[] {
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
 * @param outputPath - 出力するzipファイルのパス
 * @param archiveTool - 使用するアーカイブコマンド
 */
export async function createArchive(
  distDir: string,
  outputPath: string,
  archiveTool: string
): Promise<void> {
  const distDirName = basename(distDir);

  const process = new Deno.Command(archiveTool, {
    args: [outputPath, distDirName],
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
    await createArchive(distDir, outputPath, archiveTool);
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

  const archiveTool = config.archiveTool || 'rip';

  console.log('📦 配布用ディレクトリアーカイブツール');
  console.log();

  // アーカイブツールのチェック
  console.log(`🔍 アーカイブツール '${archiveTool}' の確認中...`);
  const isAvailable = await checkArchiveTool(archiveTool);

  if (!isAvailable) {
    console.error(`❌ エラー: アーカイブツール '${archiveTool}' が見つかりません`);
    console.error(`   '${archiveTool}' がインストールされているか確認してください`);
    console.error(`   または config.ts の archiveTool を変更してください`);
    Deno.exit(1);
  }

  console.log(`   ✅ '${archiveTool}' が利用可能です`);
  console.log();

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
