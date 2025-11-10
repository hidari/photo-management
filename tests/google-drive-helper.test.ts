/**
 * Google Driveヘルパーライブラリのテスト
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import {
  createEventFolder,
  createFolderWithParent,
  createModelFolder,
  findFolder,
  makeFilePublic,
  makeFolderPublic,
  uploadFile,
} from '../tools/lib/google-drive-helper.ts';

/**
 * テスト用の一時ディレクトリ
 */
const TEST_CONFIG_DIR = './tests/tmp-google-drive';

/**
 * テストディレクトリのみクリーンアップ（環境変数は復元しない）
 */
async function cleanupTestDir() {
  try {
    await Deno.remove(TEST_CONFIG_DIR, { recursive: true });
  } catch {
    // ディレクトリが存在しない場合は無視
  }
}

// --- モックを使ったGoogle Drive API関数のテスト ---

/**
 * fetchのモックヘルパー
 */
function mockFetch(response: {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 404),
      json: response.json ?? (async () => ({})),
      text: response.text ?? (async () => ''),
    } as Response;
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

/**
 * findFolder: フォルダが見つかった場合
 */
Deno.test('findFolder: フォルダが見つかった場合IDを返す', async () => {
  const restore = mockFetch({
    ok: true,
    json: async () => ({ files: [{ id: 'folder-id-123', name: 'TestFolder' }] }),
  });

  const folderId = await findFolder('test-token', 'TestFolder');

  assertEquals(folderId, 'folder-id-123');

  restore();
});

/**
 * findFolder: フォルダが見つからない場合
 */
Deno.test('findFolder: フォルダが見つからない場合nullを返す', async () => {
  const restore = mockFetch({
    ok: true,
    json: async () => ({ files: [] }),
  });

  const folderId = await findFolder('test-token', 'NonExistent');

  assertEquals(folderId, null);

  restore();
});

/**
 * createFolderWithParent: フォルダ作成に成功
 */
Deno.test('createFolderWithParent: フォルダ作成に成功する', async () => {
  const restore = mockFetch({
    ok: true,
    json: async () => ({ id: 'new-folder-id-456' }),
  });

  const folderId = await createFolderWithParent('test-token', 'NewFolder');

  assertEquals(folderId, 'new-folder-id-456');

  restore();
});

/**
 * createFolderWithParent: 親IDを指定してフォルダ作成
 */
Deno.test('createFolderWithParent: 親IDを指定してフォルダ作成する', async () => {
  const restore = mockFetch({
    ok: true,
    json: async () => ({ id: 'child-folder-id' }),
  });

  const folderId = await createFolderWithParent('test-token', 'ChildFolder', 'parent-id');

  assertEquals(folderId, 'child-folder-id');

  restore();
});

/**
 * makeFilePublic: ファイルを公開してダウンロードURLを返す
 */
Deno.test('makeFilePublic: ファイルを公開してダウンロードURLを返す', async () => {
  const restore = mockFetch({
    ok: true,
  });

  const downloadUrl = await makeFilePublic('test-token', 'file-id-123');

  assertStringIncludes(downloadUrl, 'https://drive.google.com/uc?export=download&id=file-id-123');

  restore();
});

/**
 * makeFolderPublic: フォルダを公開して共有URLを返す
 */
Deno.test('makeFolderPublic: フォルダを公開して共有URLを返す', async () => {
  const restore = mockFetch({
    ok: true,
  });

  const shareUrl = await makeFolderPublic('test-token', 'folder-id-789');

  assertStringIncludes(shareUrl, 'https://drive.google.com/drive/folders/folder-id-789');

  restore();
});

/**
 * createEventFolder: 既存フォルダを再利用
 */
Deno.test('createEventFolder: 既存フォルダを再利用する', async () => {
  const restore = mockFetch({
    ok: true,
    json: async () => ({ files: [{ id: 'existing-event-folder-id' }] }),
  });

  const folderId = await createEventFolder('test-token', 'parent-id', '20251012', 'テストイベント');

  assertEquals(folderId, 'existing-event-folder-id');

  restore();
});

/**
 * createModelFolder: 既存フォルダを再利用
 */
Deno.test('createModelFolder: 既存フォルダを再利用する', async () => {
  const restore = mockFetch({
    ok: true,
    json: async () => ({ files: [{ id: 'existing-model-folder-id' }] }),
  });

  const folderId = await createModelFolder('test-token', 'parent-id', 'モデルA');

  assertEquals(folderId, 'existing-model-folder-id');

  restore();
});

/**
 * uploadFile: ファイルをアップロードする
 */
Deno.test('uploadFile: ファイルをアップロードする', async () => {
  await cleanupTestDir();
  await Deno.mkdir(TEST_CONFIG_DIR, { recursive: true });

  // テスト用ファイルを作成
  const testFilePath = join(TEST_CONFIG_DIR, 'test-photo.jpg');
  await Deno.writeTextFile(testFilePath, 'test image content');

  const restore = mockFetch({
    ok: true,
    json: async () => ({ id: 'uploaded-file-id' }),
  });

  const fileId = await uploadFile('test-token', testFilePath, 'folder-id');

  assertEquals(fileId, 'uploaded-file-id');

  restore();
  await cleanupTestDir();
});
