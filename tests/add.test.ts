import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { detectMissingModels } from '../tools/add.ts';
import { buildDirectoryStructure } from '../tools/lib/directory-structure.ts';
import type { Event } from '../types/distribution-config.ts';
import { testConfig } from './helpers/test-config.ts';

/**
 * テスト用の一時ディレクトリ
 */
const TEST_DIR = './tests/tmp-add';

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
 * detectMissingModelsのテスト: すべてのディレクトリが存在しない場合
 */
Deno.test('detectMissingModels: すべてのディレクトリが存在しない場合全モデルを返す', async () => {
  await cleanup();

  const testConfigForAdd = {
    ...testConfig,
    developedDirectoryBase: TEST_DIR,
  };

  const event: Event = {
    date: '20251012',
    event_name: 'テストイベント',
    models: [
      { name: 'モデルA', outreach: true },
      { name: 'モデルB', outreach: false },
      { name: 'モデルC', outreach: false },
    ],
  };

  const structure = buildDirectoryStructure(event, testConfigForAdd);

  const missing = await detectMissingModels(structure);

  assertEquals(missing.length, 3);
  assertEquals(missing, ['モデルA', 'モデルB', 'モデルC']);

  await cleanup();
});

/**
 * detectMissingModelsのテスト: 一部のディレクトリが存在する場合
 */
Deno.test('detectMissingModels: 一部のディレクトリが存在する場合不足分のみ返す', async () => {
  await cleanup();

  const testConfigForAdd = {
    ...testConfig,
    developedDirectoryBase: TEST_DIR,
  };

  const event: Event = {
    date: '20251012',
    event_name: 'テストイベント',
    models: [
      { name: 'モデルA', outreach: true },
      { name: 'モデルB', outreach: false },
      { name: 'モデルC', outreach: false },
    ],
  };

  const structure = buildDirectoryStructure(event, testConfigForAdd);

  // モデルAとモデルCのディレクトリのみ作成（モデルBは作成しない）
  await Deno.mkdir(structure.models[0].distDir, { recursive: true });
  await Deno.mkdir(structure.models[2].distDir, { recursive: true });

  const missing = await detectMissingModels(structure);

  assertEquals(missing.length, 1);
  assertEquals(missing, ['モデルB']);

  await cleanup();
});

/**
 * detectMissingModelsのテスト: すべてのディレクトリが存在する場合
 */
Deno.test('detectMissingModels: すべてのディレクトリが存在する場合空配列を返す', async () => {
  await cleanup();

  const testConfigForAdd = {
    ...testConfig,
    developedDirectoryBase: TEST_DIR,
  };

  const event: Event = {
    date: '20251012',
    event_name: 'テストイベント',
    models: [
      { name: 'モデルA', outreach: true },
      { name: 'モデルB', outreach: false },
    ],
  };

  const structure = buildDirectoryStructure(event, testConfigForAdd);

  // すべてのディレクトリを作成
  for (const model of structure.models) {
    await Deno.mkdir(model.distDir, { recursive: true });
  }

  const missing = await detectMissingModels(structure);

  assertEquals(missing.length, 0);
  assertEquals(missing, []);

  await cleanup();
});

/**
 * detectMissingModelsのテスト: モデルが0人の場合
 */
Deno.test('detectMissingModels: モデルが0人の場合空配列を返す', async () => {
  await cleanup();

  const testConfigForAdd = {
    ...testConfig,
    developedDirectoryBase: TEST_DIR,
  };

  const event: Event = {
    date: '20251012',
    event_name: 'テストイベント',
    models: [],
  };

  const structure = buildDirectoryStructure(event, testConfigForAdd);

  const missing = await detectMissingModels(structure);

  assertEquals(missing.length, 0);
  assertEquals(missing, []);

  await cleanup();
});
