import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import { parse as parseToml } from 'https://deno.land/std@0.208.0/toml/mod.ts';
import { renderModelTemplate, updateTomlWithMessages } from '../tools/build-distribution.ts';
import type { DirectoryConfig } from '../types/directory-config.ts';

/**
 * テスト用の一時ディレクトリ
 */
const TEST_DIR = './tests/tmp-distribution';

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
 * renderModelTemplateのテスト: MODEL_OUTREACH.eta
 */
Deno.test('renderModelTemplate: MODEL_OUTREACH.etaを正しくレンダリングする', async () => {
  const result = await renderModelTemplate(
    './templates/MODEL_OUTREACH.eta',
    'テストモデル',
    'テストイベント',
    'https://example.com/download'
  );

  assertExists(result);
  assertEquals(result.includes('テストモデルさん、こんばんは！'), true);
  assertEquals(result.includes('テストイベント'), true);
  assertEquals(result.includes('https://example.com/download'), true);
});

/**
 * renderModelTemplateのテスト: MODEL_FOLLOW_UP.eta
 */
Deno.test('renderModelTemplate: MODEL_FOLLOW_UP.etaを正しくレンダリングする', async () => {
  const result = await renderModelTemplate(
    './templates/MODEL_FOLLOW_UP.eta',
    'テストモデル',
    'テストイベント',
    'https://example.com/download'
  );

  assertExists(result);
  assertEquals(result.includes('テストモデルさん、こんばんは！'), true);
  assertEquals(result.includes('テストイベント'), true);
  assertEquals(result.includes('https://example.com/download'), true);
});

/**
 * updateTomlWithMessagesのテスト
 */
Deno.test('updateTomlWithMessages: TOMLファイルにメッセージを追記する', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const directoryConfig: DirectoryConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [
          {
            name: 'モデルA',
            outreach: true,
            sns: 'https://twitter.com/model_a',
            download_url: 'https://example.com/download_a',
          },
          {
            name: 'モデルB',
            outreach: false,
            download_url: 'https://example.com/download_b',
          },
        ],
      },
    ],
  };

  const tomlPath = join(TEST_DIR, 'test.toml');
  await updateTomlWithMessages(tomlPath, directoryConfig);

  // ファイルが生成されたことを確認
  const content = await Deno.readTextFile(tomlPath);
  assertExists(content);

  // TOMLファイルの内容をパースして検証
  const parsed = parseToml(content) as unknown as DirectoryConfig;
  assertEquals(parsed.events.length, 1);
  assertEquals(parsed.events[0].models.length, 2);

  // モデルAのメッセージが追加されていることを確認
  const modelA = parsed.events[0].models[0];
  assertExists(modelA.message);
  assertEquals(modelA.message.includes('モデルAさん、こんばんは！'), true);
  assertEquals(modelA.message.includes('Hidariと申します'), true);
  assertEquals(modelA.message.includes('https://example.com/download_a'), true);

  // モデルBのメッセージが追加されていることを確認
  const modelB = parsed.events[0].models[1];
  assertExists(modelB.message);
  assertEquals(modelB.message.includes('モデルBさん、こんばんは！'), true);
  assertEquals(modelB.message.includes('先日の'), true);
  assertEquals(modelB.message.includes('https://example.com/download_b'), true);

  await cleanup();
});

/**
 * updateTomlWithMessagesのテスト: download_urlがない場合はスキップする
 */
Deno.test('updateTomlWithMessages: download_urlがない場合はスキップする', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const directoryConfig: DirectoryConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [
          {
            name: 'モデルD',
            outreach: true,
            sns: 'https://twitter.com/model_d',
            download_url: '',
          },
          {
            name: 'モデルE',
            outreach: false,
            download_url: 'https://example.com/download_e',
          },
        ],
      },
    ],
  };

  const tomlPath = join(TEST_DIR, 'test_skip.toml');

  // エラーが発生しないことを確認
  await updateTomlWithMessages(tomlPath, directoryConfig);

  // TOMLファイルの内容をパースして検証
  const content = await Deno.readTextFile(tomlPath);
  const parsed = parseToml(content) as unknown as DirectoryConfig;

  // モデルDのmessageは未設定（スキップされた）
  const modelD = parsed.events[0].models[0];
  assertEquals(modelD.message, undefined);

  // モデルEのmessageは設定されている
  const modelE = parsed.events[0].models[1];
  assertExists(modelE.message);
  assertEquals(modelE.message.includes('モデルEさん、こんばんは！'), true);

  await cleanup();
});

/**
 * updateTomlWithMessagesのテスト: 複数モデル
 */
Deno.test('updateTomlWithMessages: 複数モデルを正しく処理する', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const directoryConfig: DirectoryConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [
          {
            name: 'モデルA',
            outreach: true,
            sns: 'https://twitter.com/model_a',
            download_url: 'https://example.com/download_a',
          },
          {
            name: 'モデルB',
            outreach: false,
            sns: 'https://twitter.com/model_b',
            download_url: 'https://example.com/download_b',
          },
          {
            name: 'モデルC',
            outreach: false,
            download_url: 'https://example.com/download_c',
          },
        ],
      },
    ],
  };

  const tomlPath = join(TEST_DIR, 'test_multi.toml');
  await updateTomlWithMessages(tomlPath, directoryConfig);

  // TOMLファイルの内容をパースして検証
  const content = await Deno.readTextFile(tomlPath);
  const parsed = parseToml(content) as unknown as DirectoryConfig;

  assertEquals(parsed.events[0].models.length, 3);
  assertExists(parsed.events[0].models[0].message);
  assertExists(parsed.events[0].models[1].message);
  assertExists(parsed.events[0].models[2].message);

  // 各モデルのメッセージが正しく生成されていることを確認
  assertEquals(parsed.events[0].models[0].message.includes('Hidariと申します'), true);
  assertEquals(parsed.events[0].models[1].message.includes('先日の'), true);
  assertEquals(parsed.events[0].models[2].message.includes('先日の'), true);

  await cleanup();
});
