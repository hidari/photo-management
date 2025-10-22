import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import {
  createEventFolder,
  createFolder,
  deleteLocalArchives,
  ensurePhotoDistributionFolder,
  findArchiveFiles,
  findFolder,
  getAccessTokenViaGcloud,
  getConfigDir,
  getCurrentAccount,
  getValidToken,
  makeFilePublic,
  updateTomlWithUrls,
  uploadFile,
} from '../tools/upload-archives.ts';
import type { DirectoryConfig } from '../types/directory-config.ts';
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
  assertEquals(configDir.includes('.config/photo-management'), true);
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
  const modelDir = join(eventDir, 'モデルA');
  const distDir = join(modelDir, '20251012_テストイベント_テスト太郎撮影_モデルA');

  await Deno.mkdir(distDir, { recursive: true });

  // zipファイルを作成
  const zipPath = join(modelDir, '20251012_テストイベント_テスト太郎撮影_モデルA.zip');
  await Deno.writeTextFile(zipPath, 'test zip content');

  const directoryConfig: DirectoryConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [{ name: 'モデルA', sns: 'https://twitter.com/a' }],
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

  const directoryConfig: DirectoryConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [{ name: 'モデルA', sns: 'https://twitter.com/a' }],
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
    const modelDir = join(eventDir, modelName);
    const distDir = join(modelDir, `20251012_テストイベント_テスト太郎撮影_${modelName}`);

    await Deno.mkdir(distDir, { recursive: true });

    // zipファイルを作成
    const zipPath = join(modelDir, `20251012_テストイベント_テスト太郎撮影_${modelName}.zip`);
    await Deno.writeTextFile(zipPath, 'test zip content');
  }

  const directoryConfig: DirectoryConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [
          { name: 'モデルA', sns: 'https://twitter.com/a' },
          { name: 'モデルB', sns: 'https://twitter.com/b' },
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
    await ensurePhotoDistributionFolder('invalid_access_token', 'test-project-id');
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    assertEquals(error instanceof Error, true);
  }
});

Deno.test('createEventFolder: 無効なアクセストークンでエラーを投げる', async () => {
  try {
    await createEventFolder(
      'invalid_access_token',
      'test-project-id',
      'parent_id',
      '20251012',
      'テストイベント'
    );
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
    await uploadFile('invalid_access_token', 'test-project-id', testFile, 'folder_id');
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    assertEquals(error instanceof Error, true);
  } finally {
    await cleanup();
  }
});

Deno.test('makeFilePublic: 無効なアクセストークンでエラーを投げる', async () => {
  try {
    await makeFilePublic('invalid_access_token', 'test-project-id', 'file_id');
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    assertEquals(error instanceof Error, true);
  }
});

/**
 * gcloud CLI統合関数のテスト
 */

Deno.test('getAccessTokenViaGcloud: gcloud CLIが見つからない場合エラーを投げる', async () => {
  // 実際のgcloudコマンドが存在する環境では、このテストは異なる動作をする可能性がある
  // 環境に依存するため、エラーハンドリングの確認のみ行う
  try {
    // このテストは実際のgcloudコマンドを実行しようとする
    // gcloudが存在しない環境では NotFound エラーになる
    // gcloudが存在する環境では認証エラーまたは成功する
    await getAccessTokenViaGcloud();

    // gcloudが存在して認証されている場合、トークンが返される
    // この場合はテスト成功
    assertEquals(true, true);
  } catch (error) {
    // エラーの場合、適切なエラーメッセージを持つErrorであることを確認
    assertEquals(error instanceof Error, true);
    const errorMessage = (error as Error).message;

    // gcloud CLIが見つからないか、または認証エラーのいずれか
    const isValidError =
      errorMessage.includes('gcloud CLIが見つかりません') ||
      errorMessage.includes('gcloudコマンドの実行に失敗') ||
      errorMessage.includes('gcloudから有効なトークンを取得できませんでした');

    assertEquals(isValidError, true, `予期しないエラーメッセージ: ${errorMessage}`);
  }
});

Deno.test('getCurrentAccount: エラーが発生してもnullを返す', async () => {
  // getCurrentAccount は例外を投げずに常にnullまたはアカウント名を返す
  const account = await getCurrentAccount();

  // nullまたは文字列であることを確認
  if (account !== null) {
    assertEquals(typeof account, 'string');
    // アカウント名が空でないことを確認
    assertEquals(account.length > 0, true);
  } else {
    assertEquals(account, null);
  }
});

Deno.test('getValidToken: getAccessTokenViaGcloud を呼び出す', async () => {
  // getValidToken は単純に getAccessTokenViaGcloud のラッパー
  try {
    const token = await getValidToken();
    // 成功した場合、トークンが文字列であることを確認
    assertEquals(typeof token, 'string');
    assertEquals(token.length > 0, true);
  } catch (error) {
    // エラーの場合も適切に処理されていることを確認
    assertEquals(error instanceof Error, true);
  }
});
