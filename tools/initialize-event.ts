/**
 * イベント情報初期化ツール
 *
 * distribution.config.example.toml を元に対話的に distribution.config.toml を作成する
 */

import { stringify as stringifyToml } from 'https://deno.land/std@0.208.0/toml/mod.ts';
import type { DistributionConfig, EventModel } from '../types/distribution-config.ts';

/**
 * 画面をクリアする
 */
function clearScreen(): void {
  console.clear();
}

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
 * 日付のバリデーション（YYYYMMDD形式）
 */
function validateDate(date: string): boolean {
  if (!/^\d{8}$/.test(date)) {
    return false;
  }

  const year = Number.parseInt(date.substring(0, 4), 10);
  const month = Number.parseInt(date.substring(4, 6), 10);
  const day = Number.parseInt(date.substring(6, 8), 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // 簡易的な日付チェック
  const testDate = new Date(year, month - 1, day);
  return (
    testDate.getFullYear() === year &&
    testDate.getMonth() === month - 1 &&
    testDate.getDate() === day
  );
}

/**
 * イベント情報を入力する
 */
function inputEventInfo(): { date: string; eventName: string } {
  console.log('=== イベント情報の入力 ===\n');

  let date = '';
  while (!date) {
    const input = readLine('イベント日付 (YYYYMMDD形式):');
    if (validateDate(input)) {
      date = input;
    } else {
      console.log('⚠ 有効な日付を YYYYMMDD 形式で入力してください（例: 20251012）\n');
    }
  }

  let eventName = '';
  while (!eventName) {
    const input = readLine('イベント名:');
    if (input.trim().length > 0) {
      eventName = input;
    } else {
      console.log('⚠ イベント名を入力してください\n');
    }
  }

  return { date, eventName };
}

/**
 * モデルリストをテキスト形式で表示する
 */
function displayModelsList(models: EventModel[]): void {
  if (models.length === 0) {
    console.log('（モデルが登録されていません）\n');
    return;
  }

  console.log('現在のモデルリスト:');
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const firstTime = model.outreach ? 'はい' : 'いいえ';
    const sns = model.sns || '（未設定）';
    console.log(`  ${i + 1}. ${model.name} (初回: ${firstTime}, SNS: ${sns})`);
  }
  console.log();
}

/**
 * モデルを追加する
 */
function addModel(): EventModel | null {
  console.log('\n=== モデルの追加 ===');
  console.log('※ モデル名は敬称なしで入力してください\n');

  const name = readLine('モデル名:');
  if (!name) {
    console.log('⚠ モデル名を入力してください\n');
    return null;
  }

  const outreachInput = readLine('初めての撮影ですか？ (y/n):', 'y').toLowerCase();
  const outreach = outreachInput === 'y' || outreachInput === 'yes';

  let sns: string | undefined;
  const snsInput = readLine('SNS URL（任意、空欄可）:');
  if (snsInput) {
    try {
      new URL(snsInput);
      sns = snsInput;
    } catch {
      console.log('⚠ 無効なURLです。SNSの登録をスキップします\n');
    }
  }

  return { name, outreach, sns };
}

/**
 * モデルを編集する
 */
function editModel(models: EventModel[]): EventModel[] | null {
  if (models.length === 0) {
    console.log('\n編集するモデルがありません。\n');
    readLine('Enterキーで戻る');
    return null;
  }

  console.log('\n=== モデルの編集 ===\n');
  displayModelsList(models);

  const indexInput = readLine(`モデル番号を選択 (1-${models.length})、0でキャンセル:`);
  const index = Number.parseInt(indexInput, 10) - 1;

  if (index < 0) {
    return null;
  }

  if (index >= models.length || Number.isNaN(index)) {
    console.log('⚠ 無効な選択です\n');
    return null;
  }

  const model = models[index];
  console.log(`\n現在の設定: ${model.name}`);
  console.log(`  初回撮影: ${model.outreach ? 'はい' : 'いいえ'}`);
  console.log(`  SNS: ${model.sns || '（未設定）'}\n`);

  const name = readLine('モデル名:', model.name);

  const outreachInput = readLine(
    '初めての撮影ですか？ (y/n):',
    model.outreach ? 'y' : 'n'
  ).toLowerCase();
  const outreach = outreachInput === 'y' || outreachInput === 'yes';

  let sns: string | undefined;
  const snsInput = readLine('SNS URL（任意、空欄可）:', model.sns);
  if (snsInput) {
    try {
      new URL(snsInput);
      sns = snsInput;
    } catch {
      console.log('⚠ 無効なURLです。前の値を保持します\n');
      sns = model.sns;
    }
  }

  const updatedModels = [...models];
  updatedModels[index] = { name, outreach, sns };

  return updatedModels;
}

/**
 * モデルを削除する
 */
function deleteModel(models: EventModel[]): EventModel[] | null {
  if (models.length === 0) {
    console.log('\n削除するモデルがありません。\n');
    readLine('Enterキーで戻る');
    return null;
  }

  console.log('\n=== モデルの削除 ===\n');
  displayModelsList(models);

  const indexInput = readLine(`モデル番号を選択 (1-${models.length})、0でキャンセル:`);
  const index = Number.parseInt(indexInput, 10) - 1;

  if (index < 0) {
    return null;
  }

  if (index >= models.length || Number.isNaN(index)) {
    console.log('⚠ 無効な選択です\n');
    return null;
  }

  const selectedModel = models[index];
  const confirmed = readLine(
    `モデル「${selectedModel.name}」を削除しますか？ (y/n):`,
    'n'
  ).toLowerCase();

  if (confirmed !== 'y' && confirmed !== 'yes') {
    return null;
  }

  return models.filter((_, i) => i !== index);
}

/**
 * モデル管理のメインループ
 */
function manageModels(date: string, eventName: string): EventModel[] | null {
  let models: EventModel[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    clearScreen();
    console.log(`イベント: ${date} ${eventName}\n`);
    displayModelsList(models);

    console.log('操作: [1]追加 [2]編集 [3]削除 [4]保存して終了 [5]キャンセル');
    const action = readLine('選択 (1-5):');

    switch (action) {
      case '1': {
        const newModel = addModel();
        if (newModel) {
          models.push(newModel);
        }
        break;
      }
      case '2': {
        const updated = editModel(models);
        if (updated) {
          models = updated;
        }
        break;
      }
      case '3': {
        const updated = deleteModel(models);
        if (updated) {
          models = updated;
        }
        break;
      }
      case '4': {
        if (models.length === 0) {
          console.log('\nモデルが1人も登録されていません。');
          const proceed = readLine('モデルなしで保存しますか？ (y/n):', 'n').toLowerCase();
          if (proceed !== 'y' && proceed !== 'yes') {
            break;
          }
        }
        return models;
      }
      case '5': {
        const confirmed = readLine('入力内容を破棄して終了しますか？ (y/n):', 'n').toLowerCase();
        if (confirmed === 'y' || confirmed === 'yes') {
          return null;
        }
        break;
      }
      default: {
        console.log('⚠ 無効な選択です。1-5を入力してください。\n');
        readLine('Enterキーで続行');
        break;
      }
    }
  }
}

/**
 * ファイルを保存する
 */
async function saveConfig(config: DistributionConfig): Promise<void> {
  const configPath = 'distribution.config.toml';

  // 既存ファイルのチェック
  try {
    await Deno.stat(configPath);

    // ファイルが存在する場合
    console.log(`\n${configPath} はすでに存在します。\n`);
    console.log('[1]上書き [2]ユニーク名で保存 [3]破棄');
    const action = readLine('選択 (1-3):');

    if (action === '3') {
      console.log('\n保存せずに終了します。');
      return;
    }

    if (action === '2') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
      const uniquePath = `distribution.config.${timestamp}.toml`;
      await Deno.writeTextFile(
        uniquePath,
        stringifyToml(config as unknown as Record<string, unknown>)
      );
      console.log(`\n✓ 設定を ${uniquePath} に保存しました`);
      return;
    }

    if (action !== '1') {
      console.log('\n⚠ 無効な選択です。保存せずに終了します。');
      return;
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
    // ファイルが存在しない場合は続行
  }

  // 上書きまたは新規作成
  await Deno.writeTextFile(configPath, stringifyToml(config as unknown as Record<string, unknown>));
  console.log(`\n✓ 設定を ${configPath} に保存しました`);
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  console.log('========================================');
  console.log('  イベント設定ツール');
  console.log('========================================\n');

  // イベント情報の入力
  const { date, eventName } = inputEventInfo();

  // モデル管理
  const models = manageModels(date, eventName);

  if (!models) {
    console.log('\n処理をキャンセルしました。');
    Deno.exit(0);
  }

  // 設定オブジェクトの作成
  const config: DistributionConfig = {
    events: [
      {
        date,
        event_name: eventName,
        models,
      },
    ],
  };

  // ファイル保存
  await saveConfig(config);

  console.log('\n完了しました！');
}

// スクリプト実行
if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\nエラー: ${error.message}`);
    } else {
      console.error('\n予期しないエラーが発生しました');
    }
    Deno.exit(1);
  }
}
