import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { exists } from 'https://deno.land/std@0.208.0/fs/exists.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import { EtaError } from 'https://deno.land/x/eta@v3.4.0/src/index.ts';
import { renderTemplate } from '../tools/generate-readme.ts';
import { minimalConfig, testConfig } from './helpers/test-config.ts';

/**
 * テスト用の一時ディレクトリ
 */
const TEST_DIR = './tests/tmp';

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
 * テンプレートレンダリングの正常系テスト
 */
Deno.test('renderTemplate: 正常なテンプレートと設定で正しい出力が生成される', async () => {
  // テスト前のクリーンアップ
  await cleanup();

  // テスト用テンプレートを作成
  const templatePath = join(TEST_DIR, 'test-template.eta');
  const outputPath = join(TEST_DIR, 'output.txt');

  await Deno.mkdir(TEST_DIR, { recursive: true });
  // テンプレートはflatMapとjoinを使って1行で作成
  await Deno.writeTextFile(templatePath, '<%= it.administrator %> - <%= it.contacts[0].X %>');

  // テンプレートをレンダリング
  await renderTemplate(templatePath, testConfig, outputPath);

  // 出力ファイルが作成されたことを確認
  const outputExists = await exists(outputPath);
  assertEquals(outputExists, true);

  // 出力内容を確認
  const output = await Deno.readTextFile(outputPath);
  assertEquals(output, 'テスト太郎 - @test_user');

  // テスト後のクリーンアップ
  await cleanup();
});

/**
 * 存在しないテンプレートファイルのエラー処理テスト
 */
Deno.test('renderTemplate: 存在しないテンプレートファイルでエラーがスローされる', async () => {
  await cleanup();

  const nonExistentPath = join(TEST_DIR, 'non-existent.eta');
  const outputPath = join(TEST_DIR, 'output.txt');

  // Deno.errors.NotFound エラーがスローされることを確認
  await assertRejects(async () => {
    await renderTemplate(nonExistentPath, testConfig, outputPath);
  }, Deno.errors.NotFound);

  await cleanup();
});

/**
 * テンプレート構文エラーのハンドリングテスト
 */
Deno.test('renderTemplate: 不正なEta構文でEtaErrorがスローされる', async () => {
  await cleanup();

  // 不正な構文を含むテンプレートを作成
  const templatePath = join(TEST_DIR, 'invalid-template.eta');
  const outputPath = join(TEST_DIR, 'output.txt');

  await Deno.mkdir(TEST_DIR, { recursive: true });
  // 閉じタグが不正なテンプレート
  await Deno.writeTextFile(templatePath, '<%= it.administrator');

  // EtaError がスローされることを確認
  await assertRejects(async () => {
    await renderTemplate(templatePath, testConfig, outputPath);
  }, EtaError);

  await cleanup();
});

/**
 * 出力ディレクトリの自動作成テスト
 */
Deno.test('renderTemplate: 存在しないディレクトリに出力する際、ディレクトリが自動作成される', async () => {
  await cleanup();

  // 深い階層のディレクトリパスを指定
  const templatePath = join(TEST_DIR, 'template.eta');
  const outputPath = join(TEST_DIR, 'nested', 'deep', 'output.txt');

  await Deno.mkdir(TEST_DIR, { recursive: true });
  await Deno.writeTextFile(templatePath, 'Test: <%= it.administrator %>');

  // レンダリングを実行
  await renderTemplate(templatePath, minimalConfig, outputPath);

  // ディレクトリが作成され、ファイルが存在することを確認
  const outputExists = await exists(outputPath);
  assertEquals(outputExists, true);

  // 出力内容を確認
  const output = await Deno.readTextFile(outputPath);
  assertEquals(output, 'Test: Minimal User');

  await cleanup();
});

/**
 * 複雑なデータ構造のレンダリングテスト
 */
Deno.test('renderTemplate: 複雑なデータ構造が正しくレンダリングされる', async () => {
  await cleanup();

  const templatePath = join(TEST_DIR, 'complex-template.eta');
  const outputPath = join(TEST_DIR, 'output.txt');

  await Deno.mkdir(TEST_DIR, { recursive: true });
  await Deno.writeTextFile(
    templatePath,
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Etaテンプレート内のテンプレートリテラル
    '<%= it.contacts.flatMap(contact => Object.entries(contact).map(([platform, handle]) => `- ${platform}: ${handle}`)).join("\\n") %>'
  );

  await renderTemplate(templatePath, testConfig, outputPath);

  const output = await Deno.readTextFile(outputPath);
  assertEquals(output, '- X: @test_user\n- Bluesky: @test.bsky.social');

  await cleanup();
});
