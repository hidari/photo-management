/**
 * SNS投稿メッセージ生成用Google Apps Scriptのセットアップツール
 *
 * このスクリプトは、config.tsから設定値を読み込み、
 * スプレッドシートバインドのGoogle Apps Scriptプロジェクトをセットアップします。
 *
 * 実行方法:
 *   deno task gas:apply-message-generator
 *
 * 前提条件:
 * 1. clasp login でGoogle認証が完了していること
 * 2. config.tsが作成され、messageGeneratorSpreadsheetIdとpostTemplateFileIdが設定されていること
 */

import { join } from 'jsr:@std/path@1';
import { config } from '../config.ts';

const APPS_SCRIPT_DIR = join(import.meta.dirname ?? '.', '..', 'apps-script', 'message-generator');
const CLASP_JSON_PATH = join(APPS_SCRIPT_DIR, '.clasp.json');

/**
 * .clasp.jsonからscriptIdを読み取る
 */
async function getScriptId(): Promise<string | null> {
  try {
    const claspJson = JSON.parse(await Deno.readTextFile(CLASP_JSON_PATH));
    return claspJson.scriptId || null;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    throw error;
  }
}

/**
 * スプレッドシートバインド型プロジェクトを作成
 */
async function ensureSpreadsheetBoundProject(spreadsheetId: string): Promise<void> {
  console.log('スプレッドシートバインド型プロジェクトを作成しています...');
  console.log(`Spreadsheet ID: ${spreadsheetId}\n`);

  // clasp create --parentIdを実行
  const createResult = await new Deno.Command('npx', {
    args: [
      'clasp',
      'create',
      '--title',
      'SNS投稿メッセージ生成',
      '--parentId',
      spreadsheetId,
      '--rootDir',
      './dist',
    ],
    cwd: APPS_SCRIPT_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
  }).output();

  if (!createResult.success) {
    throw new Error(
      'clasp createに失敗しました。\n' +
        'スプレッドシートIDが正しいか確認してください。\n' +
        `Spreadsheet ID: ${spreadsheetId}`
    );
  }

  console.log('✅ スプレッドシートバインド型プロジェクトを作成しました\n');
}

/**
 * config.tsから必要な設定値を抽出する
 */
function extractGasConfig(): Record<string, string> {
  const properties: Record<string, string> = {};

  // SNS投稿メッセージテンプレートファイルID（必須）
  if (config.postTemplateFileId) {
    properties.POST_TEMPLATE_FILE_ID = config.postTemplateFileId;
  } else {
    throw new Error(
      'config.tsにpostTemplateFileIdが設定されていません。\n' +
        '設定例: postTemplateFileId: "your-template-file-id"'
    );
  }

  return properties;
}

/**
 * appsscript.jsonにexecutionApiを追加する
 * executionApiが既に存在する場合はスキップ
 */
async function ensureExecutionApi(): Promise<void> {
  const appsscriptJsonPath = join(APPS_SCRIPT_DIR, 'appsscript.json');

  try {
    const content = await Deno.readTextFile(appsscriptJsonPath);
    const appsscriptJson = JSON.parse(content);

    // executionApiが既に存在する場合はスキップ
    if (appsscriptJson.executionApi) {
      console.log('✅ executionApiは既に設定されています');
      return;
    }

    // executionApiを追加
    appsscriptJson.executionApi = {
      access: 'MYSELF',
    };

    // ファイルに書き戻し
    await Deno.writeTextFile(appsscriptJsonPath, `${JSON.stringify(appsscriptJson, null, 2)}\n`);

    console.log('✅ appsscript.jsonにexecutionApiを追加しました');
  } catch (error) {
    console.warn('⚠️  appsscript.jsonの更新に失敗しました:', error);
  }
}

/**
 * setup-properties.ts を生成する
 */
function generateSetupPropertiesCode(properties: Record<string, string>): string {
  return `/**
 * PropertiesServiceに設定値を登録する関数
 *
 * この関数は tools/setup-message-generator.ts から clasp run 経由で実行されます。
 * ファイルの内容は deno task gas:apply-message-generator 実行時に自動的に上書きされます。
 *
 * 注意: このファイルを手動で編集しないでください。
 */

// biome-ignore lint/correctness/noUnusedVariables: clasp runから実行される想定なので未使用でも大丈夫
function setupPropertiesFromCli() {
  const props = PropertiesService.getScriptProperties();
  const properties: Record<string, string> = ${JSON.stringify(properties, null, 2)};

  for (const [key, value] of Object.entries(properties)) {
    props.setProperty(key, value);
    Logger.log(\`設定しました: \${key}\`);
  }

  return { success: true, count: Object.keys(properties).length };
}
`;
}

/**
 * claspコマンドでPropertiesServiceに設定を登録する
 */
async function setupProperties(properties: Record<string, string>): Promise<void> {
  console.log('PropertiesServiceに設定を登録します...\n');

  // appsscript.jsonにexecutionApiを追加
  await ensureExecutionApi();
  console.log('');

  // 設定内容を表示
  console.log('登録する設定:');
  for (const [key, value] of Object.entries(properties)) {
    // IDは一部マスク
    const displayValue = key.includes('ID') ? `${value.substring(0, 8)}...` : value;
    console.log(`  ${key}: ${displayValue}`);
  }
  console.log('');

  // setup-properties.ts を作成（message-generator用の独立ファイル）
  const setupFunctionCode = generateSetupPropertiesCode(properties);

  // srcディレクトリに保存
  const setupPropertiesFile = join(APPS_SCRIPT_DIR, 'src', 'setup-properties.ts');
  await Deno.writeTextFile(setupPropertiesFile, setupFunctionCode);

  // TypeScriptをコンパイル
  console.log('スクリプトをコンパイルしています...');
  const tscResult = await new Deno.Command('npx', {
    args: ['tsc', '--project', join(APPS_SCRIPT_DIR, 'tsconfig.json')],
    cwd: APPS_SCRIPT_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
  }).output();

  if (!tscResult.success) {
    throw new Error('TypeScriptのコンパイルに失敗しました');
  }

  // appsscript.jsonをdistディレクトリにコピー
  console.log('appsscript.jsonをdistにコピーしています...');
  const appsscriptJsonPath = join(APPS_SCRIPT_DIR, 'appsscript.json');
  const distAppsscriptJsonPath = join(APPS_SCRIPT_DIR, 'dist', 'appsscript.json');

  try {
    await Deno.copyFile(appsscriptJsonPath, distAppsscriptJsonPath);
    console.log('✅ appsscript.jsonをコピーしました\n');
  } catch (error) {
    throw new Error(`appsscript.jsonのコピーに失敗しました: ${error}`);
  }

  // claspでpush
  console.log('Google Apps Scriptにデプロイしています...');
  const pushResult = await new Deno.Command('npx', {
    args: ['clasp', 'push', '--force'],
    cwd: APPS_SCRIPT_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
  }).output();

  if (!pushResult.success) {
    throw new Error('clasp pushに失敗しました');
  }

  // バージョンを作成
  console.log('\nバージョンを作成しています...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const versionDescription = `Message generator setup - ${timestamp}`;

  const versionResult = await new Deno.Command('npx', {
    args: ['clasp', 'version', versionDescription],
    cwd: APPS_SCRIPT_DIR,
    stdout: 'piped',
    stderr: 'piped',
  }).output();

  if (!versionResult.success) {
    const errorText = new TextDecoder().decode(versionResult.stderr);
    throw new Error(`clasp versionに失敗しました: ${errorText}`);
  }

  // バージョン番号を取得
  const versionOutput = new TextDecoder().decode(versionResult.stdout);
  const versionMatch = versionOutput.match(/Created version (\d+)/);

  if (!versionMatch) {
    console.warn('⚠️ バージョン番号の取得に失敗しました。デプロイ作成をスキップします。');
  } else {
    const versionNumber = versionMatch[1];
    console.log(`✅ バージョン ${versionNumber} を作成しました\n`);

    // デプロイを作成
    console.log('デプロイを作成しています...');
    const deploymentDescription = `Message generator deployment - ${timestamp}`;

    const deployResult = await new Deno.Command('npx', {
      args: ['clasp', 'deploy', '-V', versionNumber, '-d', deploymentDescription],
      cwd: APPS_SCRIPT_DIR,
      stdout: 'inherit',
      stderr: 'inherit',
    }).output();

    if (!deployResult.success) {
      console.warn('⚠️  デプロイの作成に失敗しましたが、処理を続行します。');
    } else {
      console.log('✅ デプロイを作成しました\n');
    }
  }

  console.log('');

  // セットアップ関数を実行
  console.log('設定を登録しています...');
  const runResult = await new Deno.Command('npx', {
    args: ['clasp', 'run', 'setupPropertiesFromCli'],
    cwd: APPS_SCRIPT_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
  }).output();

  if (!runResult.success) {
    throw new Error(
      'clasp runに失敗しました。\n\n' +
        'このコマンドを実行するには、事前にGoogle Cloud Platformでの設定が必要です。\n' +
        '詳細は docs/GASセットアップガイド.md の「事前準備（GCP設定）」セクションを参照してください。\n\n' +
        '設定が完了している場合は、以下の方法で手動実行できます：\n' +
        '- スプレッドシートの「拡張機能」→「Apps Script」から setupPropertiesFromCli() を実行'
    );
  }

  console.log('\n✅ 設定の登録が完了しました！');
}

/**
 * メイン処理
 */
async function main() {
  console.log('SNS投稿メッセージ生成用Google Apps Scriptセットアップツール\n');

  try {
    // config.tsから必須設定を確認
    if (!config.messageGeneratorSpreadsheetId) {
      throw new Error(
        'config.tsにmessageGeneratorSpreadsheetIdが設定されていません。\n' +
          '設定例: messageGeneratorSpreadsheetId: "your-spreadsheet-id"'
      );
    }

    const spreadsheetId = config.messageGeneratorSpreadsheetId;
    console.log(`Target Spreadsheet: ${spreadsheetId}\n`);

    // scriptIdを確認
    let scriptId = await getScriptId();

    // .clasp.jsonが存在しない、またはscriptIdが空の場合はclasp createでプロジェクトを作成
    if (!scriptId) {
      console.log('.clasp.jsonが見つからないため、新規プロジェクトを作成します。\n');
      await ensureSpreadsheetBoundProject(spreadsheetId);

      // 再度scriptIdを取得
      scriptId = await getScriptId();
      if (!scriptId) {
        throw new Error('clasp create後もscriptIdを取得できませんでした');
      }
    }

    console.log(`Script ID: ${scriptId}\n`);

    // config.tsから設定を抽出
    const properties = extractGasConfig();

    // PropertiesServiceに設定を登録
    await setupProperties(properties);

    console.log('\n次のステップ:');
    console.log('1. スプレッドシートを開いてカスタムメニューが表示されることを確認してください');
    console.log(`   https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
    console.log('2. READY列をTRUEに設定してメッセージ生成をテストしてください');
    console.log('3. onEdit()トリガーが自動的に動作することを確認してください');
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
