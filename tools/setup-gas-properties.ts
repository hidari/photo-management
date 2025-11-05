/**
 * Google Apps ScriptのPropertiesServiceに設定値を登録するスクリプト
 *
 * このスクリプトは、config.tsから設定値を読み込み、
 * Google Apps Script APIを経由してPropertiesServiceに設定を登録します。
 * さらに、必要に応じてGoogle Driveフォルダを自動作成し、
 * 自動作成されたIDをconfig.tsに書き戻します。
 *
 * 実行方法:
 *   deno task gas:setup
 *
 * 前提条件:
 * 1. clasp login でGoogle認証が完了していること
 * 2. config.tsが作成されていること（設定は自動補完されます）
 * 3. apps-script/.clasp.jsonにscriptIdが設定されていること
 */

import { join } from 'jsr:@std/path@1';
import { config } from '../config.ts';
import { updateConfigFields } from './lib/config-writer.ts';
import { getAccessToken } from './lib/google-auth.ts';
import { ensurePhotoDistributionFolder } from './lib/google-drive-helper.ts';

const APPS_SCRIPT_DIR = join(import.meta.dirname ?? '.', '..', 'apps-script');
const CLASP_JSON_PATH = join(APPS_SCRIPT_DIR, '.clasp.json');

/**
 * .clasp.jsonからscriptIdを読み取る
 */
async function getScriptId(): Promise<string> {
  try {
    const claspJson = JSON.parse(await Deno.readTextFile(CLASP_JSON_PATH));
    const scriptId = claspJson.scriptId;

    if (!scriptId) {
      throw new Error('.clasp.jsonにscriptIdが設定されていません');
    }

    return scriptId;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`.clasp.jsonが見つかりません: ${CLASP_JSON_PATH}`);
    }
    throw error;
  }
}

/**
 * config.tsから必要な設定値を抽出する
 * photoDistributionFolderIdは後で自動作成される可能性があるため、ここでは必須チェックしない
 */
function extractGasConfig(): Record<string, string> {
  const properties: Record<string, string> = {};

  // 通知先メールアドレス（必須）
  if (config.cleanupNotificationEmail) {
    properties.NOTIFICATION_EMAIL = config.cleanupNotificationEmail;
  } else {
    throw new Error(
      'config.tsにcleanupNotificationEmailが設定されていません。\n' +
        '設定例: cleanupNotificationEmail: "your-email@example.com"'
    );
  }

  // 保持期間（デフォルト: 30日）
  const retentionDays = config.distributionRetentionDays ?? 30;
  properties.RETENTION_DAYS = String(retentionDays);

  // photoDistributionFolderIdは自動作成される可能性があるため、ここでは追加しない

  // ログスプレッドシートID（オプション）
  if (config.logSpreadsheetId) {
    properties.LOG_SPREADSHEET_ID = config.logSpreadsheetId;
  }

  return properties;
}

/**
 * claspコマンドでPropertiesServiceに設定を登録する
 */
async function setupProperties(properties: Record<string, string>): Promise<void> {
  console.log('🔧 PropertiesServiceに設定を登録します...\n');

  // 設定内容を表示
  console.log('登録する設定:');
  for (const [key, value] of Object.entries(properties)) {
    // メールアドレスとIDは一部マスク
    let displayValue = value;
    if (key === 'NOTIFICATION_EMAIL') {
      const [local, domain] = value.split('@');
      displayValue = `${local?.substring(0, 3)}***@${domain}`;
    } else if (key.includes('ID')) {
      displayValue = `${value.substring(0, 8)}...`;
    }
    console.log(`  ${key}: ${displayValue}`);
  }
  console.log('');

  // setup-properties.ts を上書き更新
  const setupFunctionCode = `/**
 * PropertiesServiceに設定値を登録する関数
 *
 * この関数は tools/setup-gas-properties.ts から clasp run 経由で実行されます。
 * ファイルの内容は deno task gas:setup 実行時に自動的に上書きされます。
 *
 * 注意: このファイルを手動で編集しないでください。
 */

// biome-ignore lint/correctness/noUnusedVariables: clasp runから実行される想定なので未使用でも大丈夫
function setupPropertiesFromCli() {
  const props = PropertiesService.getUserProperties();
  const properties = ${JSON.stringify(properties, null, 2)};

  for (const [key, value] of Object.entries(properties)) {
    props.setProperty(key, value);
    Logger.log(\`設定しました: \${key}\`);
  }

  return { success: true, count: Object.keys(properties).length };
}
`;

  // 常設ファイルに保存（毎回上書き）
  const setupPropertiesFile = join(APPS_SCRIPT_DIR, 'src', 'setup-properties.ts');
  await Deno.writeTextFile(setupPropertiesFile, setupFunctionCode);

  // TypeScriptをコンパイル
  console.log('📦 スクリプトをコンパイルしています...');
  const tscResult = await new Deno.Command('npx', {
    args: ['tsc', '--project', join(APPS_SCRIPT_DIR, 'tsconfig.json')],
    cwd: APPS_SCRIPT_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
  }).output();

  if (!tscResult.success) {
    throw new Error('TypeScriptのコンパイルに失敗しました');
  }

  // claspでpush
  console.log('📤 Google Apps Scriptにデプロイしています...');
  const pushResult = await new Deno.Command('npx', {
    args: ['clasp', 'push', '--force'],
    cwd: APPS_SCRIPT_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
  }).output();

  if (!pushResult.success) {
    throw new Error('clasp pushに失敗しました');
  }

  // セットアップ関数を実行
  console.log('⚙️  設定を登録しています...');
  const runResult = await new Deno.Command('npx', {
    args: ['clasp', 'run', 'setupPropertiesFromCli'],
    cwd: APPS_SCRIPT_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
  }).output();

  if (!runResult.success) {
    throw new Error(
      'clasp runに失敗しました。\n' +
        'Google Apps Scriptエディタで手動で実行するか、\n' +
        'clasp login --creds <credentials.json> で認証情報を確認してください。'
    );
  }

  console.log('\n✅ 設定の登録が完了しました！');
}

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 Google Apps Script設定セットアップツール\n');

  try {
    // scriptIdを確認
    const scriptId = await getScriptId();
    console.log(`📋 Script ID: ${scriptId}\n`);

    // Google Drive APIのアクセストークンを取得
    console.log('🔑 Google認証情報を取得しています...');

    if (!config.googleDrive) {
      throw new Error(
        'config.tsにgoogleDrive設定が見つかりません。\n' +
          'clientIdとclientSecretを設定してください。'
      );
    }

    const accessToken = await getAccessToken(
      config.googleDrive.clientId,
      config.googleDrive.clientSecret
    );
    console.log('✅ 認証情報を取得しました\n');

    // photoDistributionFolderIdの検証・取得
    const photoDistributionFolderId = await ensurePhotoDistributionFolder(
      accessToken,
      config.photoDistributionFolderId
    );

    // config.tsから設定を抽出
    const properties = extractGasConfig();

    // photoDistributionFolderIdを追加
    properties.PHOTO_DISTRIBUTION_FOLDER_ID = photoDistributionFolderId;

    // PropertiesServiceに設定を登録
    await setupProperties(properties);

    // config.tsへの書き戻しが必要な項目を収集
    const configUpdates: Record<string, string> = {};

    // photoDistributionFolderIdが変更された場合
    if (config.photoDistributionFolderId !== photoDistributionFolderId) {
      configUpdates.photoDistributionFolderId = photoDistributionFolderId;
    }

    // config.tsを更新
    if (Object.keys(configUpdates).length > 0) {
      console.log('\n📝 config.tsを更新しています...');
      const updated = await updateConfigFields(configUpdates);

      if (updated) {
        console.log('✅ config.tsを更新しました\n');
      } else {
        console.warn('⚠️  config.tsの更新に失敗しました。手動で設定してください。\n');
      }
    }

    console.log('\n次のステップ:');
    console.log('1. Google Apps Scriptエディタでトリガーを設定してください');
    console.log(`   https://script.google.com/home/projects/${scriptId}/triggers`);
    console.log('2. testCleanup() 関数を手動実行して動作確認してください');
    console.log('3. ログスプレッドシートは初回実行時に自動作成されます');
  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

// スクリプト実行
if (import.meta.main) {
  await main();
}
