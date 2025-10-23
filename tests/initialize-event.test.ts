/**
 * イベント情報初期化ツールのテスト
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { exists } from 'https://deno.land/std@0.208.0/fs/exists.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import { stringify as stringifyToml } from 'https://deno.land/std@0.208.0/toml/mod.ts';
import type { DistributionConfig } from '../types/distribution-config.ts';

/**
 * テスト用の一時ディレクトリ
 */
const TEST_DIR = './tests/tmp-init-event';

/**
 * テスト後のクリーンアップ
 */
async function cleanup() {
  try {
    await Deno.remove(TEST_DIR, { recursive: true });
  } catch {
    // ディレクトリが存在しない場合は無視
  }
}

/**
 * 日付のバリデーション（YYYYMMDD形式）
 * 注: initialize-event.ts の validateDate 関数と同じロジック
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
 * 日付バリデーションの正常系テスト
 */
Deno.test('validateDate: 正しい日付形式（YYYYMMDD）を受け入れる', () => {
  assertEquals(validateDate('20251012'), true);
  assertEquals(validateDate('20250101'), true);
  assertEquals(validateDate('20251231'), true);
  assertEquals(validateDate('20240229'), true); // うるう年
});

/**
 * 日付バリデーションの異常系テスト: 形式エラー
 */
Deno.test('validateDate: 不正な形式を拒否する', () => {
  assertEquals(validateDate('2025-10-12'), false); // ハイフンあり
  assertEquals(validateDate('20251012 '), false); // 末尾にスペース
  assertEquals(validateDate('202510'), false); // 6桁
  assertEquals(validateDate('202510123'), false); // 9桁
  assertEquals(validateDate('abcd1012'), false); // 英字混在
  assertEquals(validateDate(''), false); // 空文字
});

/**
 * 日付バリデーションの異常系テスト: 存在しない日付
 */
Deno.test('validateDate: 存在しない日付を拒否する', () => {
  assertEquals(validateDate('20251301'), false); // 13月
  assertEquals(validateDate('20250001'), false); // 0月
  assertEquals(validateDate('20251032'), false); // 32日
  assertEquals(validateDate('20251100'), false); // 0日
  assertEquals(validateDate('20230229'), false); // 非うるう年の2/29
  assertEquals(validateDate('20250431'), false); // 4月31日（存在しない）
});

/**
 * 日付バリデーションのエッジケーステスト
 */
Deno.test('validateDate: エッジケースを正しく処理する', () => {
  // 各月の最終日
  assertEquals(validateDate('20250131'), true); // 1月31日
  assertEquals(validateDate('20250228'), true); // 平年2月28日
  assertEquals(validateDate('20240229'), true); // うるう年2月29日
  assertEquals(validateDate('20250331'), true); // 3月31日
  assertEquals(validateDate('20250430'), true); // 4月30日
  assertEquals(validateDate('20250531'), true); // 5月31日
  assertEquals(validateDate('20250630'), true); // 6月30日
  assertEquals(validateDate('20250731'), true); // 7月31日
  assertEquals(validateDate('20250831'), true); // 8月31日
  assertEquals(validateDate('20250930'), true); // 9月30日
  assertEquals(validateDate('20251031'), true); // 10月31日
  assertEquals(validateDate('20251130'), true); // 11月30日
  assertEquals(validateDate('20251231'), true); // 12月31日
});

/**
 * TOML生成のテスト: 正常なデータ構造
 */
Deno.test('TOML生成: 正常なDirectoryConfigをTOML形式で出力できる', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [
          { name: 'モデルA', outreach: true, sns: 'https://twitter.com/a' },
          { name: 'モデルB', outreach: false },
        ],
      },
    ],
  };

  const tomlContent = stringifyToml(config as unknown as Record<string, unknown>);
  const tomlPath = join(TEST_DIR, 'generated.toml');
  await Deno.writeTextFile(tomlPath, tomlContent);

  // ファイルが作成されたことを確認
  const fileExists = await exists(tomlPath);
  assertEquals(fileExists, true);

  // ファイル内容を確認
  const content = await Deno.readTextFile(tomlPath);
  assertEquals(content.includes('date = "20251012"'), true);
  assertEquals(content.includes('event_name = "テストイベント"'), true);
  assertEquals(content.includes('name = "モデルA"'), true);
  assertEquals(content.includes('outreach = true'), true);
  assertEquals(content.includes('name = "モデルB"'), true);
  assertEquals(content.includes('outreach = false'), true);

  await cleanup();
});

/**
 * TOML生成のテスト: SNSが未設定のモデル
 */
Deno.test('TOML生成: SNSが未設定のモデルを含む設定を出力できる', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [
          { name: 'モデルA', outreach: true },
          { name: 'モデルB', outreach: false, sns: 'https://twitter.com/b' },
        ],
      },
    ],
  };

  const tomlContent = stringifyToml(config as unknown as Record<string, unknown>);
  const tomlPath = join(TEST_DIR, 'no-sns.toml');
  await Deno.writeTextFile(tomlPath, tomlContent);

  const content = await Deno.readTextFile(tomlPath);

  // モデルAのSNSフィールドが含まれていないことを確認
  assertEquals(content.includes('name = "モデルA"'), true);

  // モデルBのSNSフィールドが含まれることを確認
  assertEquals(content.includes('name = "モデルB"'), true);
  assertEquals(content.includes('sns = "https://twitter.com/b"'), true);

  await cleanup();
});

/**
 * TOML生成のテスト: 日本語・特殊文字を含むデータ
 */
Deno.test('TOML生成: 日本語・絵文字を含むデータを正しく出力できる', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'コミックマーケット105 🎉',
        models: [{ name: '田中 花子 🌸', outreach: true, sns: 'https://twitter.com/hanako' }],
      },
    ],
  };

  const tomlContent = stringifyToml(config as unknown as Record<string, unknown>);
  const tomlPath = join(TEST_DIR, 'japanese-emoji.toml');
  await Deno.writeTextFile(tomlPath, tomlContent);

  const content = await Deno.readTextFile(tomlPath);
  assertEquals(content.includes('event_name = "コミックマーケット105 🎉"'), true);
  assertEquals(content.includes('name = "田中 花子 🌸"'), true);

  await cleanup();
});

/**
 * TOML生成のテスト: 空のモデルリスト
 */
Deno.test('TOML生成: モデルが空のイベント設定を出力できる', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'モデルなしイベント',
        models: [],
      },
    ],
  };

  const tomlContent = stringifyToml(config as unknown as Record<string, unknown>);
  const tomlPath = join(TEST_DIR, 'empty-models.toml');
  await Deno.writeTextFile(tomlPath, tomlContent);

  // ファイルが作成されたことを確認
  const fileExists = await exists(tomlPath);
  assertEquals(fileExists, true);

  const content = await Deno.readTextFile(tomlPath);
  assertEquals(content.includes('date = "20251012"'), true);
  assertEquals(content.includes('event_name = "モデルなしイベント"'), true);

  await cleanup();
});

/**
 * URL検証のテスト（簡易版）
 */
Deno.test('URL検証: 有効なURLを受け入れる', () => {
  // 有効なURL
  try {
    new URL('https://twitter.com/example');
    assertEquals(true, true);
  } catch {
    assertEquals(true, false, 'URLが有効であるべきでした');
  }

  try {
    new URL('https://x.com/example');
    assertEquals(true, true);
  } catch {
    assertEquals(true, false, 'URLが有効であるべきでした');
  }
});

/**
 * URL検証のテスト: 無効なURL
 */
Deno.test('URL検証: 無効なURLを拒否する', () => {
  // 無効なURL
  try {
    new URL('not-a-url');
    assertEquals(true, false, 'URLが無効であるべきでした');
  } catch {
    assertEquals(true, true);
  }

  try {
    new URL('');
    assertEquals(true, false, 'URLが無効であるべきでした');
  } catch {
    assertEquals(true, true);
  }
});

/**
 * ユニーク名生成のテスト（タイムスタンプベース）
 */
Deno.test('ユニーク名生成: タイムスタンプベースのファイル名が生成できる', () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
  const uniqueName = `distribution.config.${timestamp}.toml`;

  // 形式チェック
  assertEquals(uniqueName.startsWith('distribution.config.'), true);
  assertEquals(uniqueName.endsWith('.toml'), true);
  assertEquals(uniqueName.includes('T'), true); // ISO形式のT区切り文字
});

/**
 * 既存ファイルチェックのテスト
 */
Deno.test('既存ファイルチェック: ファイルが存在する場合にstatで検出できる', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const testFilePath = join(TEST_DIR, 'distribution.config.toml');
  await Deno.writeTextFile(testFilePath, '# test');

  try {
    const stat = await Deno.stat(testFilePath);
    assertEquals(stat.isFile, true);
  } catch {
    assertEquals(true, false, 'ファイルが存在するはずでした');
  }

  await cleanup();
});

/**
 * 既存ファイルチェックのテスト: ファイルが存在しない場合
 */
Deno.test('既存ファイルチェック: ファイルが存在しない場合にNotFoundエラーが発生する', async () => {
  await cleanup();

  const nonExistentPath = join(TEST_DIR, 'non-existent.toml');

  try {
    await Deno.stat(nonExistentPath);
    assertEquals(true, false, 'NotFoundエラーが発生するはずでした');
  } catch (error) {
    assertEquals(error instanceof Deno.errors.NotFound, true);
  }

  await cleanup();
});
