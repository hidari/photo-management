/**
 * ディレクトリ構造ライブラリのテスト
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import {
  findArchiveFiles,
  findPhotoFiles,
  listDistDirectories,
  listDistributionFiles,
  listPhotoFiles,
} from '../tools/lib/directory-structure.ts';
import type { DistributionConfig } from '../types/distribution-config.ts';
import { testConfig } from './helpers/test-config.ts';

/**
 * テスト用の一時ディレクトリ
 */
const TEST_DIR = './tests/tmp-directory-structure';

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
 * listDistDirectories: DIST_DIRのパス一覧を取得
 */
Deno.test('listDistDirectories: DIST_DIRのパス一覧を取得する', () => {
  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [
          { name: 'モデルA', outreach: true },
          { name: 'モデルB', outreach: false },
        ],
      },
    ],
  };

  const distDirs = listDistDirectories(config, testConfig);

  assertEquals(distDirs.length, 2);
  assertStringIncludes(distDirs[0], 'モデルA');
  assertStringIncludes(distDirs[1], 'モデルB');
});

/**
 * listDistDirectories: 複数イベントのDIST_DIRを取得
 */
Deno.test('listDistDirectories: 複数イベントのDIST_DIRを取得する', () => {
  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'イベント1',
        models: [{ name: 'モデルA', outreach: true }],
      },
      {
        date: '20251013',
        event_name: 'イベント2',
        models: [{ name: 'モデルB', outreach: false }],
      },
    ],
  };

  const distDirs = listDistDirectories(config, testConfig);

  assertEquals(distDirs.length, 2);
});

/**
 * listPhotoFiles: 写真ファイルのみを取得する
 */
Deno.test('listPhotoFiles: 写真ファイルのみを取得する', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  // 写真ファイルを作成
  await Deno.writeTextFile(join(TEST_DIR, 'photo1.jpg'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'photo2.png'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, '_README.txt'), 'readme'); // 除外されるべき

  const photos = await listPhotoFiles(TEST_DIR);

  assertEquals(photos.length, 2);
  assertEquals(photos[0].endsWith('photo1.jpg'), true);
  assertEquals(photos[1].endsWith('photo2.png'), true);

  await cleanup();
});

/**
 * listPhotoFiles: サポートされている拡張子のみを取得
 */
Deno.test('listPhotoFiles: サポートされている拡張子のみを取得する', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  // 様々な拡張子のファイルを作成
  await Deno.writeTextFile(join(TEST_DIR, 'photo.jpg'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'photo.jpeg'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'photo.png'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'photo.gif'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'photo.webp'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'document.pdf'), 'test'); // 除外されるべき
  await Deno.writeTextFile(join(TEST_DIR, 'data.json'), 'test'); // 除外されるべき

  const photos = await listPhotoFiles(TEST_DIR);

  assertEquals(photos.length, 5);

  await cleanup();
});

/**
 * listPhotoFiles: 空のディレクトリの場合空配列を返す
 */
Deno.test('listPhotoFiles: 空のディレクトリの場合空配列を返す', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const photos = await listPhotoFiles(TEST_DIR);

  assertEquals(photos.length, 0);

  await cleanup();
});

/**
 * listDistributionFiles: 写真ファイルと_README.txtを取得する
 */
Deno.test('listDistributionFiles: 写真ファイルと_README.txtを取得する', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  // 写真ファイルと_README.txtを作成
  await Deno.writeTextFile(join(TEST_DIR, 'photo1.jpg'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'photo2.png'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, '_README.txt'), 'readme');

  const files = await listDistributionFiles(TEST_DIR);

  assertEquals(files.length, 3);
  assertEquals(files[0].endsWith('_README.txt'), true);
  assertEquals(files[1].endsWith('photo1.jpg'), true);
  assertEquals(files[2].endsWith('photo2.png'), true);

  await cleanup();
});

/**
 * listDistributionFiles: サポートされている拡張子のみを取得
 */
Deno.test('listDistributionFiles: サポートされている拡張子のみを取得する', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  // 様々な拡張子のファイルと_README.txtを作成
  await Deno.writeTextFile(join(TEST_DIR, 'photo.jpg'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'photo.jpeg'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'photo.png'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'photo.gif'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'photo.webp'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, '_README.txt'), 'readme');
  await Deno.writeTextFile(join(TEST_DIR, 'document.pdf'), 'test'); // 除外されるべき
  await Deno.writeTextFile(join(TEST_DIR, 'data.json'), 'test'); // 除外されるべき

  const files = await listDistributionFiles(TEST_DIR);

  assertEquals(files.length, 6); // 写真5枚 + _README.txt

  await cleanup();
});

/**
 * listDistributionFiles: _README.txtがない場合は写真のみ
 */
Deno.test('listDistributionFiles: _README.txtがない場合は写真のみを取得する', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  // 写真ファイルのみ作成
  await Deno.writeTextFile(join(TEST_DIR, 'photo1.jpg'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'photo2.png'), 'test');

  const files = await listDistributionFiles(TEST_DIR);

  assertEquals(files.length, 2);
  assertEquals(files[0].endsWith('photo1.jpg'), true);
  assertEquals(files[1].endsWith('photo2.png'), true);

  await cleanup();
});

/**
 * listDistributionFiles: 空のディレクトリの場合空配列を返す
 */
Deno.test('listDistributionFiles: 空のディレクトリの場合空配列を返す', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const files = await listDistributionFiles(TEST_DIR);

  assertEquals(files.length, 0);

  await cleanup();
});

/**
 * findArchiveFiles: アーカイブファイルの情報を取得
 */
Deno.test('findArchiveFiles: アーカイブファイルの情報を取得する', async () => {
  await cleanup();

  const testConfigForArchive = {
    ...testConfig,
    developedDirectoryBase: TEST_DIR,
  };

  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [{ name: 'モデルA', outreach: true }],
      },
    ],
  };

  // イベントディレクトリとzipファイルを作成
  const eventDir = join(TEST_DIR, '20251012_テストイベント');
  const distDir = join(
    eventDir,
    `20251012_テストイベント_${testConfig.administrator}撮影_モデルAさん`
  );
  await Deno.mkdir(distDir, { recursive: true });

  const zipPath = `${distDir}.zip`;
  await Deno.writeTextFile(zipPath, 'test zip content');

  const archives = await findArchiveFiles(config, testConfigForArchive);

  assertEquals(archives.length, 1);
  assertEquals(archives[0].modelName, 'モデルA');
  assertEquals(archives[0].eventDate, '20251012');
  assertEquals(archives[0].eventName, 'テストイベント');

  await cleanup();
});

/**
 * findPhotoFiles: モデルごとの写真情報を取得
 */
Deno.test('findPhotoFiles: モデルごとの写真情報を取得する', async () => {
  await cleanup();

  const testConfigForPhotos = {
    ...testConfig,
    developedDirectoryBase: TEST_DIR,
  };

  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [{ name: 'モデルA', outreach: true }],
      },
    ],
  };

  // イベントディレクトリと写真ファイルを作成
  const eventDir = join(TEST_DIR, '20251012_テストイベント');
  const distDir = join(
    eventDir,
    `20251012_テストイベント_${testConfig.administrator}撮影_モデルAさん`
  );
  await Deno.mkdir(distDir, { recursive: true });

  await Deno.writeTextFile(join(distDir, 'photo1.jpg'), 'test');
  await Deno.writeTextFile(join(distDir, 'photo2.jpg'), 'test');

  const modelPhotos = await findPhotoFiles(config, testConfigForPhotos);

  assertEquals(modelPhotos.length, 1);
  assertEquals(modelPhotos[0].modelName, 'モデルA');
  assertEquals(modelPhotos[0].photos.length, 2);

  await cleanup();
});

/**
 * listDistDirectories: モデルが0人の場合空配列を返す
 */
Deno.test('listDistDirectories: モデルが0人の場合空配列を返す', () => {
  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'モデルなしイベント',
        models: [],
      },
    ],
  };

  const distDirs = listDistDirectories(config, testConfig);

  assertEquals(distDirs.length, 0);
});

/**
 * findArchiveFiles: zipファイルが存在しない場合空配列
 */
Deno.test('findArchiveFiles: zipファイルが存在しない場合空配列を返す', async () => {
  await cleanup();

  const testConfigForArchive = {
    ...testConfig,
    developedDirectoryBase: TEST_DIR,
  };

  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [{ name: 'モデルA', outreach: true }],
      },
    ],
  };

  // イベントディレクトリのみ作成（zipなし）
  const eventDir = join(TEST_DIR, '20251012_テストイベント');
  const distDir = join(
    eventDir,
    `20251012_テストイベント_${testConfig.administrator}撮影_モデルAさん`
  );
  await Deno.mkdir(distDir, { recursive: true });

  const archives = await findArchiveFiles(config, testConfigForArchive);

  assertEquals(archives.length, 0);

  await cleanup();
});

/**
 * listPhotoFiles: ソート順を確認
 */
Deno.test('listPhotoFiles: ファイル名順にソートされる', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  // ランダムな順序でファイルを作成
  await Deno.writeTextFile(join(TEST_DIR, 'photo3.jpg'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'photo1.jpg'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, 'photo2.jpg'), 'test');

  const photos = await listPhotoFiles(TEST_DIR);

  assertEquals(photos.length, 3);
  assertEquals(photos[0].endsWith('photo1.jpg'), true);
  assertEquals(photos[1].endsWith('photo2.jpg'), true);
  assertEquals(photos[2].endsWith('photo3.jpg'), true);

  await cleanup();
});

/**
 * findPhotoFiles: ディレクトリが存在しない場合警告して空配列
 */
Deno.test('findPhotoFiles: ディレクトリが存在しない場合警告して空配列を返す', async () => {
  await cleanup();

  const testConfigForPhotos = {
    ...testConfig,
    developedDirectoryBase: TEST_DIR,
  };

  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [{ name: 'モデルA', outreach: true }],
      },
    ],
  };

  // ディレクトリを作成しない

  const modelPhotos = await findPhotoFiles(config, testConfigForPhotos);

  assertEquals(modelPhotos.length, 0);

  await cleanup();
});

/**
 * listDistributionFiles: サブディレクトリ内のファイルも再帰的に取得する
 */
Deno.test('listDistributionFiles: サブディレクトリ内のファイルも再帰的に取得する', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  // ルートディレクトリのファイル
  await Deno.writeTextFile(join(TEST_DIR, 'photo1.jpg'), 'test');
  await Deno.writeTextFile(join(TEST_DIR, '_README.txt'), 'readme');

  // サブディレクトリ1のファイル
  const subDir1 = join(TEST_DIR, 'subdir1');
  await Deno.mkdir(subDir1);
  await Deno.writeTextFile(join(subDir1, 'photo2.jpg'), 'test');
  await Deno.writeTextFile(join(subDir1, 'photo3.png'), 'test');

  // サブディレクトリ2のファイル
  const subDir2 = join(TEST_DIR, 'subdir2');
  await Deno.mkdir(subDir2);
  await Deno.writeTextFile(join(subDir2, 'photo4.jpg'), 'test');

  // ネストしたサブディレクトリのファイル
  const subDir3 = join(subDir1, 'nested');
  await Deno.mkdir(subDir3);
  await Deno.writeTextFile(join(subDir3, 'photo5.jpg'), 'test');

  const files = await listDistributionFiles(TEST_DIR);

  assertEquals(files.length, 6); // _README.txt + 5枚の写真

  await cleanup();
});

/**
 * listDistributionFiles: システムディレクトリを除外する
 */
Deno.test('listDistributionFiles: システムディレクトリを除外する', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  // 通常のファイル
  await Deno.writeTextFile(join(TEST_DIR, 'photo1.jpg'), 'test');

  // システムディレクトリ内のファイル（除外されるべき）
  const gitDir = join(TEST_DIR, '.git');
  await Deno.mkdir(gitDir);
  await Deno.writeTextFile(join(gitDir, 'config.jpg'), 'test');

  const nodeModulesDir = join(TEST_DIR, 'node_modules');
  await Deno.mkdir(nodeModulesDir);
  await Deno.writeTextFile(join(nodeModulesDir, 'package.jpg'), 'test');

  const macosxDir = join(TEST_DIR, '__MACOSX');
  await Deno.mkdir(macosxDir);
  await Deno.writeTextFile(join(macosxDir, 'resource.jpg'), 'test');

  // ドットで始まるディレクトリ（除外されるべき）
  const dotDir = join(TEST_DIR, '.hidden');
  await Deno.mkdir(dotDir);
  await Deno.writeTextFile(join(dotDir, 'hidden.jpg'), 'test');

  const files = await listDistributionFiles(TEST_DIR);

  assertEquals(files.length, 1); // photo1.jpg のみ
  assertEquals(files[0].endsWith('photo1.jpg'), true);

  await cleanup();
});

/**
 * listDistributionFiles: システムファイルを除外する
 */
Deno.test('listDistributionFiles: システムファイルを除外する（再帰的）', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  // 通常のファイル
  await Deno.writeTextFile(join(TEST_DIR, 'photo1.jpg'), 'test');

  // システムファイル（除外されるべき）
  await Deno.writeTextFile(join(TEST_DIR, '.DS_Store'), 'system');
  await Deno.writeTextFile(join(TEST_DIR, '._photo1.jpg'), 'resource fork');

  // サブディレクトリ内のファイル
  const subDir = join(TEST_DIR, 'subdir');
  await Deno.mkdir(subDir);
  await Deno.writeTextFile(join(subDir, 'photo2.jpg'), 'test');
  await Deno.writeTextFile(join(subDir, '.DS_Store'), 'system');
  await Deno.writeTextFile(join(subDir, '._photo2.jpg'), 'resource fork');

  const files = await listDistributionFiles(TEST_DIR);

  assertEquals(files.length, 2); // photo1.jpg と photo2.jpg のみ

  await cleanup();
});
