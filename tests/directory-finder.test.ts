/**
 * ディレクトリ検索ライブラリのテスト
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import {
  findLatestEventDir,
  findTomlConfigPath,
  findTomlInEventDir,
} from '../tools/lib/directory-finder.ts';
import { testConfig } from './helpers/test-config.ts';

/**
 * テスト用の一時ディレクトリ
 */
const TEST_DIR = 'tests/tmp-directory-finder';

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
 * findLatestEventDir: 最新のイベントディレクトリを見つける
 */
Deno.test('findLatestEventDir: 最新のイベントディレクトリを見つける', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  // 複数のイベントディレクトリを作成（異なる時刻で）
  const dir1 = join(TEST_DIR, '20251010_イベント1');
  const dir2 = join(TEST_DIR, '20251011_イベント2');
  const dir3 = join(TEST_DIR, '20251012_イベント3');

  await Deno.mkdir(dir1);
  await new Promise((resolve) => setTimeout(resolve, 10)); // 時間差を作る
  await Deno.mkdir(dir2);
  await new Promise((resolve) => setTimeout(resolve, 10));
  await Deno.mkdir(dir3);

  const latest = await findLatestEventDir(TEST_DIR);

  // 最も新しく作成されたdir3が返される
  assertEquals(latest, dir3);

  await cleanup();
});

/**
 * findLatestEventDir: ディレクトリが存在しない場合nullを返す
 */
Deno.test('findLatestEventDir: ディレクトリが存在しない場合nullを返す', async () => {
  await cleanup();

  const latest = await findLatestEventDir(join(TEST_DIR, 'non-existent'));

  assertEquals(latest, null);

  await cleanup();
});

/**
 * findLatestEventDir: 空のディレクトリの場合nullを返す
 */
Deno.test('findLatestEventDir: 空のディレクトリの場合nullを返す', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const latest = await findLatestEventDir(TEST_DIR);

  assertEquals(latest, null);

  await cleanup();
});

/**
 * findTomlInEventDir: TOMLファイルを見つける
 */
Deno.test('findTomlInEventDir: TOMLファイルを見つける', async () => {
  await cleanup();
  const eventDir = join(TEST_DIR, '20251012_イベント');
  await Deno.mkdir(eventDir, { recursive: true });

  // TOMLファイルを作成
  const tomlPath = join(eventDir, 'distribution.config.toml');
  await Deno.writeTextFile(tomlPath, '# test');

  const foundPath = await findTomlInEventDir(eventDir);

  assertEquals(foundPath, tomlPath);

  await cleanup();
});

/**
 * findTomlInEventDir: TOMLファイルが存在しない場合nullを返す
 */
Deno.test('findTomlInEventDir: TOMLファイルが存在しない場合nullを返す', async () => {
  await cleanup();
  const eventDir = join(TEST_DIR, '20251012_イベント');
  await Deno.mkdir(eventDir, { recursive: true });

  const foundPath = await findTomlInEventDir(eventDir);

  assertEquals(foundPath, null);

  await cleanup();
});

/**
 * findTomlInEventDir: ディレクトリが存在しない場合nullを返す
 */
Deno.test('findTomlInEventDir: ディレクトリが存在しない場合nullを返す', async () => {
  await cleanup();

  const foundPath = await findTomlInEventDir(join(TEST_DIR, 'non-existent'));

  assertEquals(foundPath, null);

  await cleanup();
});

/**
 * findTomlConfigPath: 最新イベントのTOML設定ファイルを見つける
 */
Deno.test('findTomlConfigPath: 最新イベントのTOML設定ファイルを見つける', async () => {
  await cleanup();

  const baseDir = join(TEST_DIR, 'developed');
  await Deno.mkdir(baseDir, { recursive: true });

  // イベントディレクトリとTOMLファイルを作成
  const eventDir = join(baseDir, '20251012_テストイベント');
  await Deno.mkdir(eventDir, { recursive: true });
  const tomlPath = join(eventDir, 'distribution.config.toml');
  await Deno.writeTextFile(tomlPath, '# test');

  const config = {
    ...testConfig,
    developedDirectoryBase: baseDir,
  };

  const foundPath = await findTomlConfigPath(config);

  assertEquals(foundPath, tomlPath);

  await cleanup();
});

/**
 * findTomlConfigPath: イベントディレクトリが存在しない場合エラー
 */
Deno.test('findTomlConfigPath: イベントディレクトリが存在しない場合エラー', async () => {
  await cleanup();

  const baseDir = join(TEST_DIR, 'developed-empty');
  await Deno.mkdir(baseDir, { recursive: true });

  const config = {
    ...testConfig,
    developedDirectoryBase: baseDir,
  };

  try {
    await findTomlConfigPath(config);
    assertEquals(true, false, 'エラーが発生するはずでした');
  } catch (error) {
    assertEquals(error instanceof Error, true);
    assertEquals((error as Error).message.includes('イベントディレクトリが見つかりません'), true);
  }

  await cleanup();
});

/**
 * findTomlConfigPath: TOMLファイルが存在しない場合エラー
 */
Deno.test('findTomlConfigPath: TOMLファイルが存在しない場合エラー', async () => {
  await cleanup();

  const baseDir = join(TEST_DIR, 'developed-no-toml');
  await Deno.mkdir(baseDir, { recursive: true });

  // イベントディレクトリのみ作成（TOMLなし）
  const eventDir = join(baseDir, '20251012_テストイベント');
  await Deno.mkdir(eventDir, { recursive: true });

  const config = {
    ...testConfig,
    developedDirectoryBase: baseDir,
  };

  try {
    await findTomlConfigPath(config);
    assertEquals(true, false, 'エラーが発生するはずでした');
  } catch (error) {
    assertEquals(error instanceof Error, true);
    assertEquals((error as Error).message.includes('tomlファイルが見つかりません'), true);
  }

  await cleanup();
});
