/**
 * ディレクトリ・ファイル検索ユーティリティ
 *
 * イベントディレクトリやTOML設定ファイルの検索機能を提供する
 */

import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';

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
