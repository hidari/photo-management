/**
 * アーカイブ作成・管理ライブラリ
 *
 * ZIPアーカイブの作成とアーカイブツールの管理機能を提供する
 */

import { basename, join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import type { Config } from '../../types/config.ts';

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
  console.log('アーカイブツールが未設定です。自動セットアップを開始します...');
  console.log();

  // rip-binary-setup.tsの関数を動的にインポート
  const { ensureRipBinary } = await import('./rip-binary-setup.ts');
  const binaryPath = await ensureRipBinary();

  console.log();

  return binaryPath;
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

    console.log(`アーカイブ作成中: ${distDirName}`);
    await createArchive(distDir, archiveTool);
    console.log(`   ✅ 完了: ${outputPath}`);
  }
}

/**
 * アーカイブファイルを削除する
 *
 * @param archivePaths - 削除するファイルパスの配列
 */
export async function deleteLocalArchives(archivePaths: string[]): Promise<void> {
  for (const path of archivePaths) {
    try {
      await Deno.remove(path);
      console.log(`   削除: ${basename(path)}`);
    } catch (error) {
      console.warn(`   ⚠️  削除失敗: ${basename(path)} - ${error}`);
    }
  }
}
