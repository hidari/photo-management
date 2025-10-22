import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import {
  buildDistributionMessagesForEvent,
  generateDistributionMessages,
  renderModelTemplate,
} from '../tools/build-distribution.ts';
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
 * generateDistributionMessagesのテスト
 */
Deno.test('generateDistributionMessages: 配布メッセージ一覧を生成する', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const messages = [
    {
      modelName: 'モデルA',
      sns: 'https://twitter.com/model_a',
      text: 'これはモデルAへのメッセージです。',
    },
    {
      modelName: 'モデルB',
      sns: '',
      text: 'これはモデルBへのメッセージです。',
    },
  ];

  const outputPath = join(TEST_DIR, 'distribution_messages.md');
  await generateDistributionMessages(messages, outputPath);

  // ファイルが生成されたことを確認
  const content = await Deno.readTextFile(outputPath);

  assertExists(content);
  assertEquals(content.includes('## モデルA'), true);
  assertEquals(content.includes('送付先: https://twitter.com/model_a'), true);
  assertEquals(content.includes('これはモデルAへのメッセージです。'), true);
  assertEquals(content.includes('## モデルB'), true);
  assertEquals(content.includes('送付先: SNS情報なし'), true);
  assertEquals(content.includes('これはモデルBへのメッセージです。'), true);

  await cleanup();
});

/**
 * buildDistributionMessagesForEventのテスト: outreach = true
 */
Deno.test('buildDistributionMessagesForEvent: outreach=trueの場合にMODEL_OUTREACHテンプレートを使用', async () => {
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
        ],
      },
    ],
  };

  const messages = await buildDistributionMessagesForEvent(directoryConfig);

  assertEquals(messages.length, 1);
  assertEquals(messages[0].modelName, 'モデルA');
  assertEquals(messages[0].sns, 'https://twitter.com/model_a');
  assertEquals(messages[0].text.includes('Hidariと申します！'), true);
});

/**
 * buildDistributionMessagesForEventのテスト: outreach = false
 */
Deno.test('buildDistributionMessagesForEvent: outreach=falseの場合にMODEL_FOLLOW_UPテンプレートを使用', async () => {
  const directoryConfig: DirectoryConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [
          {
            name: 'モデルB',
            outreach: false,
            sns: 'https://twitter.com/model_b',
            download_url: 'https://example.com/download_b',
          },
        ],
      },
    ],
  };

  const messages = await buildDistributionMessagesForEvent(directoryConfig);

  assertEquals(messages.length, 1);
  assertEquals(messages[0].modelName, 'モデルB');
  assertEquals(messages[0].sns, 'https://twitter.com/model_b');
  assertEquals(messages[0].text.includes('先日の'), true);
  assertEquals(messages[0].text.includes('例によって'), true);
});

/**
 * buildDistributionMessagesForEventのテスト: SNSなし
 */
Deno.test('buildDistributionMessagesForEvent: SNSがない場合は空文字になる', async () => {
  const directoryConfig: DirectoryConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [
          {
            name: 'モデルC',
            outreach: false,
            download_url: 'https://example.com/download_c',
          },
        ],
      },
    ],
  };

  const messages = await buildDistributionMessagesForEvent(directoryConfig);

  assertEquals(messages.length, 1);
  assertEquals(messages[0].modelName, 'モデルC');
  assertEquals(messages[0].sns, '');
});

/**
 * buildDistributionMessagesForEventのテスト: download_urlがない場合はエラー
 */
Deno.test('buildDistributionMessagesForEvent: download_urlがない場合はエラーを投げる', async () => {
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
          },
        ],
      },
    ],
  };

  try {
    await buildDistributionMessagesForEvent(directoryConfig);
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    assertEquals(error instanceof Error, true);
    assertEquals((error as Error).message.includes('download_urlが設定されていません'), true);
  }
});

/**
 * buildDistributionMessagesForEventのテスト: 複数モデル
 */
Deno.test('buildDistributionMessagesForEvent: 複数モデルを正しく処理する', async () => {
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

  const messages = await buildDistributionMessagesForEvent(directoryConfig);

  assertEquals(messages.length, 3);
  assertEquals(messages[0].modelName, 'モデルA');
  assertEquals(messages[1].modelName, 'モデルB');
  assertEquals(messages[2].modelName, 'モデルC');
  assertEquals(messages[2].sns, '');
});
