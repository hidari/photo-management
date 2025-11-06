#!/usr/bin/env deno run --allow-read --allow-write --allow-net --allow-env

/**
 * Google Drive上の古いイベントフォルダ削除ツール(CLI版)
 *
 * このスクリプトは、指定した日数より古いイベントフォルダを検出・削除する
 *
 * 使い方:
 *   deno task cleanup                    # 削除対象を表示（dry-run）
 *   deno task cleanup --execute          # 実際に削除を実行
 *   deno task cleanup --days 60          # 保持期間を60日に設定
 */

import { parse as parseFlags } from 'https://deno.land/std@0.208.0/flags/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import config from '../config.ts';
import type { Config } from '../types/config.ts';
import { type CleanupResult, cleanupOldEvents, type EventFolderInfo } from './lib/cleanup-logic.ts';
import { getAccessToken, getAuthClient, getCurrentAccount } from './lib/google-auth.ts';

/**
 * 設定ディレクトリのパスを取得
 */
export function getConfigDir(): string {
  const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
  return join(home, '.config', 'photo-management');
}

/**
 * PhotoDistributionフォルダのIDを読み込む
 *
 * @returns フォルダID（見つからない場合はnull）
 */
export async function loadFolderId(): Promise<string | null> {
  try {
    const configDir = getConfigDir();
    const folderIdPath = join(configDir, 'folder-id.txt');
    return (await Deno.readTextFile(folderIdPath)).trim();
  } catch {
    return null;
  }
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
 * 保持期間を取得する
 *
 * @param appConfig - アプリケーション設定
 * @returns 保持期間(日数)
 */
export function getRetentionDays(appConfig: Config): number {
  return appConfig.distributionRetentionDays ?? 30;
}

/**
 * スクリプトエントリーポイント
 */
async function main() {
  const args = parseFlags(Deno.args, {
    boolean: ['execute', 'help'],
    string: ['days'],
  });

  if (args.help) {
    console.log('Google Drive上の古いイベントフォルダ削除ツール');
    console.log();
    console.log('使い方:');
    console.log('  deno task cleanup                    # 削除対象を表示（dry-run）');
    console.log('  deno task cleanup --execute          # 実際に削除を実行');
    console.log('  deno task cleanup --days 60          # 保持期間を60日に設定');
    console.log();
    Deno.exit(0);
  }

  console.log('🗑️  古いイベントフォルダ削除ツール');
  console.log();

  // Google Drive設定の存在確認
  if (!config.googleDrive) {
    console.error('❌ エラー: Google Drive設定が見つかりません');
    console.error('   config.tsにgoogleDrive設定を追加してください');
    Deno.exit(1);
  }

  // OAuth認証を実行
  console.log('🔐 Google Drive認証を確認中...');

  try {
    const client = await getAuthClient(
      config.googleDrive.clientId,
      config.googleDrive.clientSecret
    );
    const currentAccount = await getCurrentAccount(client);

    if (currentAccount) {
      console.log(`   👤 認証アカウント: ${currentAccount}`);
    }
    console.log('   ✅ 認証完了');
  } catch (error) {
    console.error('❌ エラー: Google Drive認証に失敗しました');
    console.error(`   詳細: ${error instanceof Error ? error.message : error}`);
    Deno.exit(1);
  }

  console.log();

  // PhotoDistributionフォルダのIDを取得
  const parentFolderId = await loadFolderId();

  if (!parentFolderId) {
    console.error('❌ エラー: PhotoDistributionフォルダIDが見つかりません');
    console.error('   先に deno task upload-folders を実行してください');
    Deno.exit(1);
  }

  console.log(`📁 PhotoDistributionフォルダ (ID: ${parentFolderId})`);
  console.log();

  // 保持期間を決定
  const retentionDays = args.days ? Number.parseInt(args.days, 10) : getRetentionDays(config);

  if (Number.isNaN(retentionDays) || retentionDays < 0) {
    console.error('❌ エラー: 保持期間は0以上の数値を指定してください');
    Deno.exit(1);
  }

  console.log(`⏰ 保持期間: ${retentionDays}日`);
  console.log();

  try {
    // アクセストークンを取得
    const accessToken = await getAccessToken(
      config.googleDrive.clientId,
      config.googleDrive.clientSecret
    );

    const dryRun = !args.execute;

    console.log(`🔍 削除対象のフォルダを検索中...`);
    const result = await cleanupOldEvents(accessToken, parentFolderId, retentionDays, dryRun);

    if (Array.isArray(result)) {
      // dry-runモード: 削除対象を表示
      const folders = result as EventFolderInfo[];

      if (folders.length === 0) {
        console.log('   ✅ 削除対象のフォルダはありません');
        console.log();
        Deno.exit(0);
      }

      console.log(`   ⚠️  ${folders.length}個のフォルダが削除対象です:`);
      console.log();

      for (const folder of folders) {
        console.log(`   • ${folder.name}`);
        console.log(`     作成日: ${folder.createdTime.toISOString().split('T')[0]}`);
        console.log(`     経過日数: ${folder.daysOld}日`);
        console.log();
      }

      console.log('📝 実際に削除するには --execute オプションを付けて実行してください:');
      console.log('   deno task cleanup --execute');
      console.log();
    } else {
      // 実行モード: 削除結果を表示
      const cleanupResult = result as CleanupResult;

      if (cleanupResult.deletedCount === 0 && cleanupResult.errors.length === 0) {
        console.log('   ✅ 削除対象のフォルダはありません');
        console.log();
        Deno.exit(0);
      }

      console.log();
      console.log(`✅ ${cleanupResult.deletedCount}個のフォルダを削除しました:`);
      console.log();

      for (const folder of cleanupResult.deletedFolders) {
        console.log(`   • ${folder.name}`);
        console.log(`     作成日: ${folder.createdTime.toISOString().split('T')[0]}`);
        console.log(`     経過日数: ${folder.daysOld}日`);
        console.log();
      }

      if (cleanupResult.errors.length > 0) {
        console.error(`⚠️  ${cleanupResult.errors.length}個のフォルダの削除に失敗しました:`);
        console.error();

        for (const error of cleanupResult.errors) {
          console.error(`   • ${error.folder.name}`);
          console.error(`     エラー: ${error.error}`);
          console.error();
        }
      }

      console.log('🎉 クリーンアップが完了しました!');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ エラー: ${error.message}`);
    } else {
      console.error('❌ エラー: 予期しない問題が発生しました');
      console.error(error);
    }

    Deno.exit(1);
  }
}

// このファイルが直接実行された場合のみ、main関数を実行する
if (import.meta.main) {
  main();
}
