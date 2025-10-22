import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import {
  archiveAllDistributions,
  findLatestEventDir,
  findTomlInEventDir,
  listDistDirectories,
  resolveArchiveTool,
} from '../tools/archive-distribution-dirs.ts';
import type { DirectoryConfig } from '../types/directory-config.ts';
import { testConfig } from './helpers/test-config.ts';

/**
 * テスト用の一時ディレクトリ
 */
const TEST_DIR = './tests/tmp-archive';

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
 * アーカイブツール解決のテスト
 */
Deno.test('resolveArchiveTool: 有効なarchiveToolが設定されている場合そのパスを返す', async () => {
  const testConfigWithTool = {
    ...testConfig,
    archiveTool: 'deno', // denoコマンドは確実に存在する
  };

  const result = await resolveArchiveTool(testConfigWithTool);
  assertEquals(result, 'deno');
});

/**
 * アーカイブツール解決のテスト: 無効なarchiveTool
 */
Deno.test('resolveArchiveTool: 無効なarchiveToolが設定されている場合エラーを投げる', async () => {
  const testConfigWithInvalidTool = {
    ...testConfig,
    archiveTool: '/nonexistent/path/to/tool',
  };

  try {
    await resolveArchiveTool(testConfigWithInvalidTool);
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    assertEquals(error instanceof Error, true);
    assertEquals((error as Error).message.includes('指定されたアーカイブツール'), true);
  }
});

/**
 * 最新イベントディレクトリ検出のテスト
 */
Deno.test('findLatestEventDir: 最新のディレクトリを正しく検出する', async () => {
  await cleanup();

  // テスト用ディレクトリを作成
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const dir1 = join(TEST_DIR, 'event1');
  const dir2 = join(TEST_DIR, 'event2');
  const dir3 = join(TEST_DIR, 'event3');

  await Deno.mkdir(dir1);
  await new Promise((resolve) => setTimeout(resolve, 10)); // 時間差を作る

  await Deno.mkdir(dir2);
  await new Promise((resolve) => setTimeout(resolve, 10));

  await Deno.mkdir(dir3);

  const latest = await findLatestEventDir(TEST_DIR);

  // dir3が最新のはず
  assertEquals(latest, dir3);

  await cleanup();
});

/**
 * 最新イベントディレクトリ検出のテスト: ディレクトリが存在しない
 */
Deno.test('findLatestEventDir: ディレクトリが存在しない場合nullを返す', async () => {
  await cleanup();

  const result = await findLatestEventDir(join(TEST_DIR, 'nonexistent'));
  assertEquals(result, null);

  await cleanup();
});

/**
 * 最新イベントディレクトリ検出のテスト: 空のディレクトリ
 */
Deno.test('findLatestEventDir: 空のディレクトリの場合nullを返す', async () => {
  await cleanup();

  await Deno.mkdir(TEST_DIR, { recursive: true });

  const result = await findLatestEventDir(TEST_DIR);
  assertEquals(result, null);

  await cleanup();
});

/**
 * TOML検索のテスト
 */
Deno.test('findTomlInEventDir: イベントディレクトリ内のTOMLファイルを見つける', async () => {
  await cleanup();

  const eventDir = join(TEST_DIR, 'event1');
  await Deno.mkdir(eventDir, { recursive: true });

  // TOMLファイルを作成
  const tomlPath = join(eventDir, 'config.toml');
  await Deno.writeTextFile(tomlPath, '# test toml');

  const found = await findTomlInEventDir(eventDir);
  assertEquals(found, tomlPath);

  await cleanup();
});

/**
 * TOML検索のテスト: TOMLファイルが存在しない
 */
Deno.test('findTomlInEventDir: TOMLファイルが存在しない場合nullを返す', async () => {
  await cleanup();

  const eventDir = join(TEST_DIR, 'event1');
  await Deno.mkdir(eventDir, { recursive: true });

  const found = await findTomlInEventDir(eventDir);
  assertEquals(found, null);

  await cleanup();
});

/**
 * TOML検索のテスト: ディレクトリが存在しない
 */
Deno.test('findTomlInEventDir: ディレクトリが存在しない場合nullを返す', async () => {
  await cleanup();

  const result = await findTomlInEventDir(join(TEST_DIR, 'nonexistent'));
  assertEquals(result, null);

  await cleanup();
});

/**
 * DIST_DIR一覧取得のテスト
 */
Deno.test('listDistDirectories: 正しくDIST_DIRのパス一覧を返す', () => {
  const directoryConfig: DirectoryConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [
          { name: 'モデルA', outreach: false, sns: 'https://twitter.com/a' },
          { name: 'モデルB', outreach: false, sns: 'https://twitter.com/b' },
        ],
      },
    ],
  };

  const distDirs = listDistDirectories(directoryConfig, testConfig);

  assertEquals(distDirs.length, 2);
  assertEquals(
    distDirs[0],
    join(
      testConfig.developedDirectoryBase,
      '20251012_テストイベント',
      'モデルA',
      '20251012_テストイベント_テスト太郎撮影_モデルA'
    )
  );
  assertEquals(
    distDirs[1],
    join(
      testConfig.developedDirectoryBase,
      '20251012_テストイベント',
      'モデルB',
      '20251012_テストイベント_テスト太郎撮影_モデルB'
    )
  );
});

/**
 * DIST_DIR一覧取得のテスト: 複数イベント
 */
Deno.test('listDistDirectories: 複数イベントの場合すべてのDIST_DIRを返す', () => {
  const directoryConfig: DirectoryConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'イベント1',
        models: [{ name: 'モデルA', outreach: false, sns: 'https://twitter.com/a' }],
      },
      {
        date: '20251013',
        event_name: 'イベント2',
        models: [
          { name: 'モデルB', outreach: false, sns: 'https://twitter.com/b' },
          { name: 'モデルC', outreach: false, sns: 'https://twitter.com/c' },
        ],
      },
    ],
  };

  const distDirs = listDistDirectories(directoryConfig, testConfig);

  // 合計3つのDIST_DIRが返されるはず
  assertEquals(distDirs.length, 3);
});

/**
 * DIST_DIR一覧取得のテスト: モデルが存在しない
 */
Deno.test('listDistDirectories: モデルが存在しない場合空配列を返す', () => {
  const directoryConfig: DirectoryConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'イベント1',
        models: [],
      },
    ],
  };

  const distDirs = listDistDirectories(directoryConfig, testConfig);

  assertEquals(distDirs.length, 0);
});

/**
 * archiveAllDistributionsのテスト
 * 注: 実際のripコマンドがないため、このテストはスキップするか、
 * エラーが発生することを確認するテストとする
 */
Deno.test('archiveAllDistributions: ripコマンドが存在しない場合エラーが発生する', async () => {
  await cleanup();

  // テスト用のディレクトリ構造を作成
  const eventDir = join(TEST_DIR, '20251012_テストイベント');
  const modelDir = join(eventDir, 'モデルA');
  const distDir = join(modelDir, '20251012_テストイベント_テスト太郎撮影_モデルA');

  await Deno.mkdir(distDir, { recursive: true });
  await Deno.writeTextFile(join(distDir, 'test.txt'), 'test content');

  const distDirs = [distDir];

  try {
    // 存在しないコマンドでarchiveAllDistributionsを呼び出すとエラーになるはず
    await archiveAllDistributions(distDirs, 'nonexistent_archive_tool_12345');
    // エラーが発生しなかった場合、このassertに到達してテストが失敗する
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    // エラーが発生することが期待される動作
    assertEquals(error instanceof Error, true);
  } finally {
    await cleanup();
  }
});

/**
 * archiveAllDistributionsのテスト: 空の配列
 */
Deno.test('archiveAllDistributions: 空の配列を渡しても正常に完了する', async () => {
  await cleanup();

  // 空の配列でも正常に完了するはず
  await archiveAllDistributions([], 'tar');

  await cleanup();
});

/**
 * listDistDirectoriesのテスト: 空のイベント配列
 */
Deno.test('listDistDirectories: 空のイベント配列の場合空配列を返す', () => {
  const directoryConfig: DirectoryConfig = {
    events: [],
  };

  const distDirs = listDistDirectories(directoryConfig, testConfig);

  assertEquals(distDirs.length, 0);
});

/**
 * findTomlInEventDirのテスト: 複数のTOMLファイルがある場合
 */
Deno.test('findTomlInEventDir: 複数のTOMLファイルがある場合最初のものを返す', async () => {
  await cleanup();

  const eventDir = join(TEST_DIR, 'event1');
  await Deno.mkdir(eventDir, { recursive: true });

  // 複数のTOMLファイルを作成
  const toml1 = join(eventDir, 'config1.toml');
  const toml2 = join(eventDir, 'config2.toml');
  await Deno.writeTextFile(toml1, '# toml1');
  await Deno.writeTextFile(toml2, '# toml2');

  const found = await findTomlInEventDir(eventDir);

  // どちらかが返される（ファイルシステムの順序に依存）
  assertEquals(found !== null, true);
  assertEquals(found?.endsWith('.toml'), true);

  await cleanup();
});

/**
 * findLatestEventDirのテスト: ファイルとディレクトリが混在する場合
 */
Deno.test('findLatestEventDir: ファイルとディレクトリが混在する場合ディレクトリのみを返す', async () => {
  await cleanup();

  await Deno.mkdir(TEST_DIR, { recursive: true });

  // ファイルを作成
  const file1 = join(TEST_DIR, 'file1.txt');
  await Deno.writeTextFile(file1, 'test content');

  // ディレクトリを作成
  const dir1 = join(TEST_DIR, 'event1');
  await Deno.mkdir(dir1);

  const latest = await findLatestEventDir(TEST_DIR);

  // ディレクトリのみが返されるはず
  assertEquals(latest, dir1);

  await cleanup();
});

/**
 * findTomlInEventDirのテスト: .tomlで終わるディレクトリが存在する場合
 */
Deno.test('findTomlInEventDir: .tomlで終わるディレクトリは無視してファイルのみを返す', async () => {
  await cleanup();

  const eventDir = join(TEST_DIR, 'event1');
  await Deno.mkdir(eventDir, { recursive: true });

  // .tomlで終わるディレクトリを作成
  const tomlDir = join(eventDir, 'config.toml');
  await Deno.mkdir(tomlDir);

  // 実際のTOMLファイルを作成
  const tomlFile = join(eventDir, 'actual.toml');
  await Deno.writeTextFile(tomlFile, '# actual toml file');

  const found = await findTomlInEventDir(eventDir);

  // ファイルのみが返されるはず
  assertEquals(found, tomlFile);

  await cleanup();
});
