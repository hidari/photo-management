#!/usr/bin/env deno run --allow-read --allow-write --allow-run --allow-env --allow-net

/**
 * 初期設定ツール
 *
 * プロジェクトの完全な初期設定を対話的に実行する
 *
 * 使い方:
 *   deno task setup
 */

import { exists } from 'https://deno.land/std@0.208.0/fs/exists.ts';
import { getAccessToken } from './lib/google-auth.ts';
import { ensureRipBinary, getBinaryPath } from './lib/rip-binary-setup.ts';

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
 * Yes/No質問
 */
function confirm(message: string, defaultValue = true): boolean {
  const defaultStr = defaultValue ? 'Y/n' : 'y/N';
  const input = readLine(`${message} (${defaultStr}):`, defaultValue ? 'y' : 'n').toLowerCase();
  return input === 'y' || input === 'yes';
}

/**
 * config.tsが既に存在するか確認
 */
async function checkConfigExists(): Promise<boolean> {
  return await exists('./config.ts');
}

/**
 * config.tsの作成をガイド
 */
async function setupConfig(): Promise<void> {
  console.log('config.ts の作成');
  console.log('-'.repeat(50));
  console.log();
  console.log('config.example.ts をベースに config.ts を作成します。');
  console.log();

  if (await checkConfigExists()) {
    console.log('✅ config.ts は既に存在します');
    const overwrite = confirm('上書きしますか?', false);
    if (!overwrite) {
      console.log('config.ts の作成をスキップしました');
      return;
    }
  }

  console.log('以下の情報を入力してください:');
  console.log();

  const administrator = readLine('管理者名（撮影者名）:', 'Hidari');
  const developedDirectoryBase = readLine(
    '現像済み画像の保存先ディレクトリ:',
    '/Users/your_name/Pictures/Developed'
  );

  console.log();
  console.log('連絡先情報を入力してください（スキップ可）:');
  const xHandle = readLine('  X (Twitter) ハンドル (@なし):');
  const email = readLine('  メールアドレス:');

  // config.tsの内容を生成
  const configContent = `import type { Config } from './types/config.ts';

const config: Config = {
  administrator: '${administrator}',
  contacts: [
${xHandle ? `    { 'X (Twitter)': '${xHandle}' },\n` : ''}${email ? `    { Email: '${email}' },\n` : ''}  ],
  developedDirectoryBase: '${developedDirectoryBase}',
  // Google Drive OAuth設定（アップロード機能を使用する場合）
  // googleDrive: {
  //   clientId: 'YOUR_CLIENT_ID',
  //   clientSecret: 'YOUR_CLIENT_SECRET',
  // },
};

export default config;
`;

  await Deno.writeTextFile('./config.ts', configContent);
  console.log();
  console.log('✅ config.ts を作成しました');
  console.log();
  console.log('注意: Google Drive OAuth設定は後で手動で追加してください');
  console.log('   詳細は config.example.ts を参照してください');
}

/**
 * ripバイナリのセットアップ
 */
async function setupRipBinary(): Promise<void> {
  console.log();
  console.log('ripバイナリのセットアップ');
  console.log('-'.repeat(50));
  console.log();

  const binaryPath = getBinaryPath();

  if (await exists(binaryPath)) {
    console.log(`✅ ripバイナリは既にインストールされています: ${binaryPath}`);
    return;
  }

  console.log('高速アーカイブ作成のため、ripバイナリをダウンロードします。');
  const proceed = confirm('ダウンロードしますか?');

  if (!proceed) {
    console.log('ripバイナリのセットアップをスキップしました');
    return;
  }

  console.log();
  await ensureRipBinary();
  console.log('✅ ripバイナリのセットアップが完了しました');
}

/**
 * Google Drive OAuth認証
 */
async function setupGoogleAuth(): Promise<void> {
  console.log();
  console.log('Google Drive OAuth認証');
  console.log('-'.repeat(50));
  console.log();

  console.log('Google Driveへのアップロード機能を使用するには、OAuth認証が必要です。');
  console.log();

  const proceed = confirm('OAuth認証を実行しますか?');

  if (!proceed) {
    console.log('OAuth認証をスキップしました');
    console.log('後で deno task upload を実行する際に認証できます');
    return;
  }

  console.log();
  console.log('注意: config.ts に Google Drive OAuth設定（clientId, clientSecret）を');
  console.log('   追加してから認証を実行してください。');
  console.log();

  const ready = confirm('設定済みですか?', false);

  if (!ready) {
    console.log('OAuth認証をスキップしました');
    console.log();
    console.log('設定方法:');
    console.log('  1. Google Cloud Console でOAuth 2.0クライアントIDを作成');
    console.log('  2. config.ts の googleDrive セクションに clientId と clientSecret を設定');
    console.log('  3. 再度 deno task setup を実行');
    return;
  }

  try {
    // config.tsを動的にインポートして認証
    const { default: config } = await import('../config.ts');

    if (!config.googleDrive) {
      console.error('❌ config.ts に googleDrive 設定が見つかりません');
      return;
    }

    console.log();
    console.log('ブラウザが開きます。Googleアカウントでログインしてください...');
    await getAccessToken(config.googleDrive.clientId, config.googleDrive.clientSecret);
    console.log('✅ OAuth認証が完了しました');
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ 認証エラー: ${error.message}`);
    } else {
      console.error('❌ 認証に失敗しました');
    }
  }
}

/**
 * Google Apps Script設定案内
 */
function showGASSetupInstructions(): void {
  console.log();
  console.log('Google Apps Script 設定（任意）');
  console.log('-'.repeat(50));
  console.log();
  console.log('Google Drive上の古い配布フォルダを自動削除するには、');
  console.log('Google Apps Scriptのセットアップが必要です。');
  console.log();
  console.log('セットアップ手順:');
  console.log('  1. clasp でログイン: npm run clasp login （apps-scriptディレクトリで実行）');
  console.log('  2. GASをデプロイ: deno task gas:deploy');
  console.log();
  console.log('詳細は .PrivateBox/Docs/GAS開発環境セットアップガイド.md を参照してください。');
}

/**
 * メイン処理
 */
async function main() {
  console.log('初期設定ツール');
  console.log('='.repeat(50));
  console.log();
  console.log('このツールは、photo-managementプロジェクトの初期設定を案内します。');
  console.log();

  try {
    // 1. config.ts作成
    await setupConfig();

    // 2. ripバイナリセットアップ
    await setupRipBinary();

    // 3. Google Drive OAuth認証
    await setupGoogleAuth();

    // 4. GAS設定案内（手動）
    showGASSetupInstructions();

    // 完了メッセージ
    console.log();
    console.log('✅ 初期設定が完了しました');
    console.log();
    console.log('次のステップ:');
    console.log('  1. deno task init でイベントを作成してください');
    console.log('  2. 配布用ディレクトリに写真を配置してください');
    console.log('  3. deno task upload でGoogle Driveにアップロードしてください');
    console.log('  4. deno task ship でモデルに配布してください');
  } catch (error) {
    console.error();
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
