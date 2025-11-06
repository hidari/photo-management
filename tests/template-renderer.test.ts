/**
 * テンプレートレンダリングライブラリのテスト
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { exists } from 'https://deno.land/std@0.208.0/fs/exists.ts';
import { renderModelTemplate, renderTemplate } from '../tools/lib/template-renderer.ts';

/**
 * テスト用の一時ディレクトリ
 */
const TEST_DIR = './tests/tmp-template-renderer';

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
 * renderTemplate: 基本的なテンプレートをレンダリング
 */
Deno.test('renderTemplate: 基本的なテンプレートをレンダリングする', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const templatePath = `${TEST_DIR}/test.eta`;
  const outputPath = `${TEST_DIR}/output.txt`;

  await Deno.writeTextFile(templatePath, 'Hello <%= it.name %>!');

  await renderTemplate(templatePath, { name: 'World' }, outputPath);

  const output = await Deno.readTextFile(outputPath);
  assertEquals(output, 'Hello World!');

  await cleanup();
});

/**
 * renderModelTemplate: モデル用テンプレートをレンダリング
 */
Deno.test('renderModelTemplate: モデル用テンプレートをレンダリングする', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const templatePath = `${TEST_DIR}/model.eta`;
  await Deno.writeTextFile(
    templatePath,
    '<%= it.modelName %>さん、<%= it.eventName %>の写真です: <%= it.downloadUrl %>'
  );

  const result = await renderModelTemplate(
    templatePath,
    'テストモデル',
    'テストイベント',
    'https://example.com/download'
  );

  assertEquals(result, 'テストモデルさん、テストイベントの写真です: https://example.com/download');

  await cleanup();
});

/**
 * renderTemplate: 出力ディレクトリが自動作成される
 */
Deno.test('renderTemplate: 出力ディレクトリが自動作成される', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const templatePath = `${TEST_DIR}/test.eta`;
  const outputPath = `${TEST_DIR}/subdir/output.txt`;

  await Deno.writeTextFile(templatePath, 'Test');

  await renderTemplate(templatePath, {}, outputPath);

  const fileExists = await exists(outputPath);
  assertEquals(fileExists, true);

  await cleanup();
});
