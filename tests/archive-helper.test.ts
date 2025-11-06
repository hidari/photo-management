/**
 * アーカイブヘルパーライブラリのテスト
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { exists } from 'https://deno.land/std@0.208.0/fs/exists.ts';
import { deleteLocalArchives } from '../tools/lib/archive-helper.ts';

/**
 * テスト用の一時ディレクトリ
 */
const TEST_DIR = './tests/tmp-archive-helper';

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
 * deleteLocalArchives: アーカイブファイルを削除する
 */
Deno.test('deleteLocalArchives: アーカイブファイルを削除する', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  // テスト用のzipファイルを作成
  const zip1 = `${TEST_DIR}/archive1.zip`;
  const zip2 = `${TEST_DIR}/archive2.zip`;

  await Deno.writeTextFile(zip1, 'test content 1');
  await Deno.writeTextFile(zip2, 'test content 2');

  // 削除実行
  await deleteLocalArchives([zip1, zip2]);

  // ファイルが削除されたことを確認
  const zip1Exists = await exists(zip1);
  const zip2Exists = await exists(zip2);

  assertEquals(zip1Exists, false);
  assertEquals(zip2Exists, false);

  await cleanup();
});

/**
 * deleteLocalArchives: 存在しないファイルを削除しようとしても エラーにならない
 */
Deno.test('deleteLocalArchives: 存在しないファイルを削除しようとしてもエラーにならない', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const nonExistent = `${TEST_DIR}/non-existent.zip`;

  // エラーが発生しないことを確認
  await deleteLocalArchives([nonExistent]);

  assertEquals(true, true); // エラーが発生しなければOK

  await cleanup();
});

/**
 * deleteLocalArchives: 空の配列を渡してもエラーにならない
 */
Deno.test('deleteLocalArchives: 空の配列を渡してもエラーにならない', async () => {
  await cleanup();

  await deleteLocalArchives([]);

  assertEquals(true, true);

  await cleanup();
});
