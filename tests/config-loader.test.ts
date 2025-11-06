/**
 * 設定ファイル読み込みライブラリのテスト
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { loadTomlConfig } from '../tools/lib/config-loader.ts';

/**
 * テスト用の一時ディレクトリ
 */
const TEST_DIR = './tests/tmp-config-loader';

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
 * loadTomlConfig: 基本的なTOMLファイルを読み込む
 */
Deno.test('loadTomlConfig: 基本的なTOMLファイルを読み込む', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "モデルA"
outreach = true

[[events.models]]
name = "モデルB"
outreach = false
`;

  const tomlPath = `${TEST_DIR}/test.toml`;
  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  assertEquals(config.events.length, 1);
  assertEquals(config.events[0].date, '20251012');
  assertEquals(config.events[0].event_name, 'テストイベント');
  assertEquals(config.events[0].models.length, 2);
  assertEquals(config.events[0].models[0].name, 'モデルA');
  assertEquals(config.events[0].models[0].outreach, true);
  assertEquals(config.events[0].models[1].name, 'モデルB');
  assertEquals(config.events[0].models[1].outreach, false);

  await cleanup();
});

/**
 * loadTomlConfig: SNS付きモデルを読み込む
 */
Deno.test('loadTomlConfig: SNS付きモデルを読み込む', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "モデルA"
outreach = true
sns = "https://x.com/modelA"
`;

  const tomlPath = `${TEST_DIR}/test-sns.toml`;
  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  assertEquals(config.events[0].models[0].sns, 'https://x.com/modelA');

  await cleanup();
});

/**
 * loadTomlConfig: download_url付きモデルを読み込む
 */
Deno.test('loadTomlConfig: download_url付きモデルを読み込む', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "モデルA"
outreach = true
download_url = "https://drive.google.com/file/d/xyz"
`;

  const tomlPath = `${TEST_DIR}/test-download.toml`;
  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  assertEquals(config.events[0].models[0].download_url, 'https://drive.google.com/file/d/xyz');

  await cleanup();
});

/**
 * loadTomlConfig: message付きモデルを読み込む
 */
Deno.test('loadTomlConfig: message付きモデルを読み込む', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "モデルA"
outreach = true
message = """
こんにちは、
写真をお送りします。
"""
`;

  const tomlPath = `${TEST_DIR}/test-message.toml`;
  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  assertEquals(config.events[0].models[0].message?.includes('こんにちは'), true);
  assertEquals(config.events[0].models[0].message?.includes('写真をお送りします'), true);

  await cleanup();
});

/**
 * loadTomlConfig: distributed付きモデルを読み込む
 */
Deno.test('loadTomlConfig: distributed付きモデルを読み込む', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "モデルA"
outreach = true
distributed = true
`;

  const tomlPath = `${TEST_DIR}/test-distributed.toml`;
  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  assertEquals(config.events[0].models[0].distributed, true);

  await cleanup();
});

/**
 * loadTomlConfig: 空のモデルリストを読み込む
 */
Deno.test('loadTomlConfig: 空のモデルリストを読み込む', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `[[events]]
date = "20251012"
event_name = "モデルなしイベント"
models = []
`;

  const tomlPath = `${TEST_DIR}/test-empty.toml`;
  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  assertEquals(config.events[0].models.length, 0);

  await cleanup();
});

/**
 * loadTomlConfig: 複数イベントを読み込む
 */
Deno.test('loadTomlConfig: 複数イベントを読み込む', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `[[events]]
date = "20251012"
event_name = "イベント1"

[[events.models]]
name = "モデルA"
outreach = true

[[events]]
date = "20251013"
event_name = "イベント2"

[[events.models]]
name = "モデルB"
outreach = false
`;

  const tomlPath = `${TEST_DIR}/test-multiple.toml`;
  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  assertEquals(config.events.length, 2);
  assertEquals(config.events[0].date, '20251012');
  assertEquals(config.events[0].event_name, 'イベント1');
  assertEquals(config.events[1].date, '20251013');
  assertEquals(config.events[1].event_name, 'イベント2');

  await cleanup();
});

/**
 * loadTomlConfig: intent_url付きモデルを読み込む
 */
Deno.test('loadTomlConfig: intent_url付きモデルを読み込む', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "モデルA"
outreach = true
intent_url = "https://twitter.com/messages/compose?recipient_id=123&text=test"
`;

  const tomlPath = `${TEST_DIR}/test-intent.toml`;
  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  assertStringIncludes(config.events[0].models[0].intent_url || '', 'twitter.com/messages/compose');

  await cleanup();
});

/**
 * loadTomlConfig: すべてのフィールドを持つモデルを読み込む
 */
Deno.test('loadTomlConfig: すべてのフィールドを持つモデルを読み込む', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "モデルA"
outreach = true
sns = "https://x.com/modelA"
download_url = "https://drive.google.com/file/d/xyz"
message = "こんにちは"
intent_url = "https://twitter.com/messages/compose?recipient_id=123"
distributed = true
`;

  const tomlPath = `${TEST_DIR}/test-full.toml`;
  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  const model = config.events[0].models[0];
  assertEquals(model.name, 'モデルA');
  assertEquals(model.outreach, true);
  assertEquals(model.sns, 'https://x.com/modelA');
  assertEquals(model.download_url, 'https://drive.google.com/file/d/xyz');
  assertEquals(model.message, 'こんにちは');
  assertStringIncludes(model.intent_url || '', 'twitter.com');
  assertEquals(model.distributed, true);

  await cleanup();
});

/**
 * loadTomlConfig: ファイルが存在しない場合エラー
 */
Deno.test('loadTomlConfig: ファイルが存在しない場合エラー', async () => {
  await cleanup();

  try {
    await loadTomlConfig(`${TEST_DIR}/non-existent.toml`);
    assertEquals(true, false, 'エラーが発生するはずでした');
  } catch (error) {
    assertEquals(error instanceof Error, true);
  }

  await cleanup();
});

/**
 * loadTomlConfig: 不正なTOML形式の場合エラー
 */
Deno.test('loadTomlConfig: 不正なTOML形式の場合エラー', async () => {
  await cleanup();
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlPath = `${TEST_DIR}/invalid.toml`;
  await Deno.writeTextFile(tomlPath, 'this is not valid toml = = =');

  try {
    await loadTomlConfig(tomlPath);
    assertEquals(true, false, 'エラーが発生するはずでした');
  } catch (error) {
    assertEquals(error instanceof Error, true);
  }

  await cleanup();
});
