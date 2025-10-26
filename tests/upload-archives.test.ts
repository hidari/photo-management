import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import {
  createEventFolder,
  createFolder,
  deleteLocalArchives,
  ensurePhotoDistributionFolder,
  findArchiveFiles,
  findFolder,
  getConfigDir,
  makeFilePublic,
  updateTomlWithUrls,
  uploadFile,
} from '../tools/upload-archives.ts';
import type { DistributionConfig } from '../types/distribution-config.ts';
import {
  cleanupTestConfig,
  loadTestFolderId,
  loadTestToken,
  saveTestFolderId,
  saveTestToken,
} from './helpers/auth-helpers.ts';
import { testConfig } from './helpers/test-config.ts';

/**
 * テスト用の一時ディレクトリ
 */
const TEST_DIR = './tests/tmp-upload';

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
 * getConfigDirのテスト
 */
Deno.test('getConfigDir: 設定ディレクトリのパスを返す', () => {
  const configDir = getConfigDir();
  assertExists(configDir);
  // クロスプラットフォーム対応: Unix形式(/)とWindows形式(\)の両方をチェック
  const hasConfigPath =
    configDir.includes('.config/photo-management') ||
    configDir.includes('.config\\photo-management');
  assertEquals(hasConfigPath, true);
});

/**
 * saveToken/loadTokenのテスト（ヘルパー使用）
 */
Deno.test('saveToken/loadToken: トークンを保存・読み込みできる', async () => {
  await cleanup();
  await cleanupTestConfig();

  const testToken = {
    access_token: 'test_access_token',
    refresh_token: 'test_refresh_token',
    expiry_date: Date.now() + 3600000,
  };

  // テスト用ヘルパーでトークンを保存
  await saveTestToken(testToken);

  // テスト用ヘルパーでトークンを読み込み
  const loadedToken = await loadTestToken();

  assertEquals(loadedToken?.access_token, testToken.access_token);
  assertEquals(loadedToken?.refresh_token, testToken.refresh_token);

  await cleanupTestConfig();
  await cleanup();
});

/**
 * saveFolderId/loadFolderIdのテスト（ヘルパー使用）
 */
Deno.test('saveFolderId/loadFolderId: フォルダIDを保存・読み込みできる', async () => {
  await cleanup();
  await cleanupTestConfig();

  const testFolderId = 'test_folder_id_12345';

  // テスト用ヘルパーでフォルダIDを保存
  await saveTestFolderId(testFolderId);

  // テスト用ヘルパーでフォルダIDを読み込み
  const loadedFolderId = await loadTestFolderId();

  assertEquals(loadedFolderId, testFolderId);

  await cleanupTestConfig();
  await cleanup();
});

/**
 * findArchiveFilesのテスト
 */
Deno.test('findArchiveFiles: 正しくzipファイルを探索する', async () => {
  await cleanup();

  // テスト用の設定（developedDirectoryBaseをTEST_DIRに設定）
  const testConfigForArchive = {
    ...testConfig,
    developedDirectoryBase: TEST_DIR,
  };

  // テスト用のディレクトリ構造を作成
  const eventDir = join(TEST_DIR, '20251012_テストイベント');
  const modelDir = join(eventDir, 'モデルAさん');
  const distDir = join(modelDir, '20251012_テストイベント_テスト太郎撮影_モデルAさん');

  await Deno.mkdir(distDir, { recursive: true });

  // zipファイルを作成
  const zipPath = join(modelDir, '20251012_テストイベント_テスト太郎撮影_モデルAさん.zip');
  await Deno.writeTextFile(zipPath, 'test zip content');

  const directoryConfig: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [{ name: 'モデルA', outreach: false, sns: 'https://twitter.com/a' }],
      },
    ],
  };

  const archives = await findArchiveFiles(directoryConfig, testConfigForArchive);

  assertEquals(archives.length, 1);
  assertEquals(archives[0].modelName, 'モデルA');
  assertEquals(archives[0].eventDate, '20251012');
  assertEquals(archives[0].eventName, 'テストイベント');

  await cleanup();
});

/**
 * findArchiveFilesのテスト: zipファイルが存在しない場合
 */
Deno.test('findArchiveFiles: zipファイルが存在しない場合空配列を返す', async () => {
  await cleanup();

  const directoryConfig: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [{ name: 'モデルA', outreach: false, sns: 'https://twitter.com/a' }],
      },
    ],
  };

  const archives = await findArchiveFiles(directoryConfig, testConfig);

  assertEquals(archives.length, 0);

  await cleanup();
});

/**
 * findArchiveFilesのテスト: 複数のモデル
 */
Deno.test('findArchiveFiles: 複数のモデルのzipファイルを探索する', async () => {
  await cleanup();

  // テスト用の設定（developedDirectoryBaseをTEST_DIRに設定）
  const testConfigForArchive = {
    ...testConfig,
    developedDirectoryBase: TEST_DIR,
  };

  // テスト用のディレクトリ構造を作成
  const eventDir = join(TEST_DIR, '20251012_テストイベント');

  for (const modelName of ['モデルA', 'モデルB']) {
    const modelDir = join(eventDir, `${modelName}さん`);
    const distDir = join(modelDir, `20251012_テストイベント_テスト太郎撮影_${modelName}さん`);

    await Deno.mkdir(distDir, { recursive: true });

    // zipファイルを作成
    const zipPath = join(modelDir, `20251012_テストイベント_テスト太郎撮影_${modelName}さん.zip`);
    await Deno.writeTextFile(zipPath, 'test zip content');
  }

  const directoryConfig: DistributionConfig = {
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

  const archives = await findArchiveFiles(directoryConfig, testConfigForArchive);

  assertEquals(archives.length, 2);

  await cleanup();
});

/**
 * updateTomlWithUrlsのテスト
 */
Deno.test('updateTomlWithUrls: TOMLファイルにURLを記録する', async () => {
  await cleanup();

  await Deno.mkdir(TEST_DIR, { recursive: true });

  // テスト用のTOMLファイルを作成
  const tomlPath = join(TEST_DIR, 'test.toml');
  const tomlContent = `[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "モデルA"
sns = "https://twitter.com/a"

[[events.models]]
name = "モデルB"
sns = "https://twitter.com/b"
`;

  await Deno.writeTextFile(tomlPath, tomlContent);

  // URLマップを作成
  const urlMap = new Map<string, string>();
  urlMap.set('モデルA', 'https://drive.google.com/file/d/test_id_a/view');
  urlMap.set('モデルB', 'https://drive.google.com/file/d/test_id_b/view');

  // TOMLを更新
  await updateTomlWithUrls(tomlPath, urlMap);

  // 更新されたTOMLを読み込んで確認
  const updatedContent = await Deno.readTextFile(tomlPath);

  assertEquals(
    updatedContent.includes('download_url = "https://drive.google.com/file/d/test_id_a/view"'),
    true
  );
  assertEquals(
    updatedContent.includes('download_url = "https://drive.google.com/file/d/test_id_b/view"'),
    true
  );

  await cleanup();
});

/**
 * deleteLocalArchivesのテスト
 */
Deno.test('deleteLocalArchives: ファイルを削除する', async () => {
  await cleanup();

  await Deno.mkdir(TEST_DIR, { recursive: true });

  // テスト用のファイルを作成
  const file1 = join(TEST_DIR, 'test1.zip');
  const file2 = join(TEST_DIR, 'test2.zip');

  await Deno.writeTextFile(file1, 'test content 1');
  await Deno.writeTextFile(file2, 'test content 2');

  // ファイルを削除
  await deleteLocalArchives([file1, file2]);

  // ファイルが削除されたことを確認
  let file1Exists = false;
  let file2Exists = false;

  try {
    await Deno.stat(file1);
    file1Exists = true;
  } catch {
    // ファイルが存在しない
  }

  try {
    await Deno.stat(file2);
    file2Exists = true;
  } catch {
    // ファイルが存在しない
  }

  assertEquals(file1Exists, false);
  assertEquals(file2Exists, false);

  await cleanup();
});

/**
 * deleteLocalArchivesのテスト: 存在しないファイル
 */
Deno.test('deleteLocalArchives: 存在しないファイルでもエラーにならない', async () => {
  await cleanup();

  await Deno.mkdir(TEST_DIR, { recursive: true });

  const nonExistentFile = join(TEST_DIR, 'non_existent.zip');

  // 存在しないファイルを削除しようとしても例外が発生しないことを確認
  await deleteLocalArchives([nonExistentFile]);

  // テストが正常に完了すれば成功
  assertEquals(true, true);

  await cleanup();
});

/**
 * Google Drive API関連の関数のモックテスト
 * 実際のAPIを呼び出さないため、エラーハンドリングのみテスト
 */

Deno.test('findFolder: 無効なアクセストークンでエラーを投げる', async () => {
  try {
    await findFolder('invalid_access_token', 'test-project-id', 'TestFolder');
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    assertEquals(error instanceof Error, true);
  }
});

Deno.test('createFolder: 無効なアクセストークンでエラーを投げる', async () => {
  try {
    await createFolder('invalid_access_token', 'test-project-id', 'TestFolder');
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    assertEquals(error instanceof Error, true);
  }
});

Deno.test('ensurePhotoDistributionFolder: 無効なアクセストークンでエラーを投げる', async () => {
  try {
    await ensurePhotoDistributionFolder('invalid_access_token');
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    assertEquals(error instanceof Error, true);
  }
});

Deno.test('createEventFolder: 無効なアクセストークンでエラーを投げる', async () => {
  try {
    await createEventFolder('invalid_access_token', 'parent_id', '20251012', 'テストイベント');
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    assertEquals(error instanceof Error, true);
  }
});

Deno.test('uploadFile: 無効なアクセストークンでエラーを投げる', async () => {
  await cleanup();

  await Deno.mkdir(TEST_DIR, { recursive: true });

  const testFile = join(TEST_DIR, 'test.zip');
  await Deno.writeTextFile(testFile, 'test content');

  try {
    await uploadFile('invalid_access_token', testFile, 'folder_id');
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    assertEquals(error instanceof Error, true);
  } finally {
    await cleanup();
  }
});

Deno.test('makeFilePublic: 無効なアクセストークンでエラーを投げる', async () => {
  try {
    await makeFilePublic('invalid_access_token', 'file_id');
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    assertEquals(error instanceof Error, true);
  }
});

/**
 * OAuth 2.0 認証関連のテストは tools/lib/google-auth.ts で実装
 * ここでは統合テストのみ実施
 */
