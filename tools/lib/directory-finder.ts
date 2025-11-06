/**
 * ディレクトリ・ファイル検索ユーティリティ
 *
 * イベントディレクトリやTOML設定ファイルの検索機能を提供する
 */

import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import type { Config } from '../../types/config.ts';

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
 * ディレクトリ名から日付（YYYYMMDD）を抽出する
 *
 * @param dirName - ディレクトリ名
 * @returns 日付文字列（抽出できない場合はnull）
 */
function extractDateFromDirName(dirName: string): string | null {
  const match = dirName.match(/^(\d{8})_/);
  return match ? match[1] : null;
}

/**
 * 日付ベースで最新のイベントディレクトリを見つける
 *
 * ディレクトリ名が "YYYYMMDD_イベント名" 形式であることを前提に、
 * 日付部分を抽出して降順ソートし、最新のものを返す
 *
 * @param baseDir - 検索対象のベースディレクトリ
 * @returns 最新のイベントディレクトリのパス（見つからない場合はnull）
 */
export async function findLatestEventDirByDate(baseDir: string): Promise<string | null> {
  try {
    const eventDirs: { path: string; date: string }[] = [];

    for await (const entry of Deno.readDir(baseDir)) {
      if (entry.isDirectory) {
        const date = extractDateFromDirName(entry.name);
        if (date) {
          eventDirs.push({ path: join(baseDir, entry.name), date });
        }
      }
    }

    if (eventDirs.length === 0) {
      return null;
    }

    // 日付降順ソート
    eventDirs.sort((a, b) => b.date.localeCompare(a.date));

    return eventDirs[0].path;
  } catch {
    return null;
  }
}

/**
 * tomlファイルのパスを自動検出する
 *
 * config.tsからdevelopedDirectoryBaseを取得し、
 * その中の最新イベントディレクトリのtomlファイルパスを返す
 *
 * @param appConfig - アプリケーション設定
 * @returns tomlファイルのパス
 * @throws {Error} - tomlファイルが見つからない場合
 */
export async function findTomlConfigPath(appConfig: Config): Promise<string> {
  const baseDir = appConfig.developedDirectoryBase;

  // ベースディレクトリの存在確認
  try {
    await Deno.stat(baseDir);
  } catch {
    throw new Error(
      `ベースディレクトリが見つかりません: ${baseDir}\n` +
        'config.ts の developedDirectoryBase を確認してください。\n' +
        'まだセットアップが完了していない場合は、deno task setup を実行してください。'
    );
  }

  // 最新イベントディレクトリを検出
  const latestEventDir = await findLatestEventDirByDate(baseDir);
  if (!latestEventDir) {
    throw new Error(
      `イベントディレクトリが見つかりません。\n` +
        `ベースディレクトリ: ${baseDir}\n` +
        'イベントディレクトリは "YYYYMMDD_イベント名" 形式で作成してください。\n' +
        '新しいイベントを作成する場合は、deno task init を実行してください。'
    );
  }

  // tomlファイルを検出
  const tomlPath = await findTomlInEventDir(latestEventDir);
  if (!tomlPath) {
    throw new Error(
      `tomlファイルが見つかりません。\n` +
        `イベントディレクトリ: ${latestEventDir}\n` +
        'distribution.config.toml ファイルが存在することを確認してください。'
    );
  }

  return tomlPath;
}
