/**
 * config-writer.tsのテスト
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  readConfigField,
  updateConfigField,
  updateConfigFields,
  updateContactsField,
} from '../tools/lib/config-writer.ts';

/**
 * テスト用の一時ディレクトリとconfig.tsパス
 */
const TEST_DIR = './tests/tmp-config';
const TEST_CONFIG_PATH = `${TEST_DIR}/config.ts`;

/**
 * 一時ディレクトリを作成
 */
async function createTestDirectory() {
  try {
    await Deno.mkdir(TEST_DIR, { recursive: true });
  } catch {
    // ディレクトリが既に存在する場合は無視
  }
}

/**
 * 一時ディレクトリを削除
 */
async function removeTestDirectory() {
  try {
    await Deno.remove(TEST_DIR, { recursive: true });
  } catch {
    // ディレクトリが存在しない場合は無視
  }
}

/**
 * テスト前のセットアップ
 */
async function setup() {
  await createTestDirectory();
}

/**
 * テスト後のクリーンアップ
 */
async function cleanup() {
  await removeTestDirectory();
}

/**
 * テスト用のconfig.tsを作成
 */
async function createTestConfig(initialContacts?: string) {
  const contactsValue = initialContacts || "[{ X: '@<YOUR_ACCOUNT_ID>' }]";
  const content = `import type { Config } from './types/config.ts';

const config: Config = {
  administrator: 'Test User',
  contacts: ${contactsValue},
  developedDirectoryBase: '/tmp/test',
};

export default config;
`;
  await Deno.writeTextFile(TEST_CONFIG_PATH, content);
}

/**
 * config.tsのcontacts値を読み取る
 */
async function readConfigContacts(): Promise<string> {
  const content = await Deno.readTextFile(TEST_CONFIG_PATH);
  const match = content.match(/contacts:\s*(\[.*?\])/s);
  return match ? match[1] : '';
}

Deno.test('updateContactsField: 単一の連絡先を追加', async () => {
  await setup();
  await createTestConfig();

  try {
    const result = await updateContactsField([{ X: '@testuser' }], TEST_CONFIG_PATH);

    assertEquals(result, true);

    const contacts = await readConfigContacts();
    assertEquals(contacts.includes('X: "@testuser"'), true);
  } finally {
    await cleanup();
  }
});

Deno.test('updateContactsField: 複数の連絡先を追加', async () => {
  await setup();
  await createTestConfig();

  try {
    const result = await updateContactsField(
      [{ X: '@user1' }, { Email: 'test@example.com' }, { Bluesky: '@test.bsky' }],
      TEST_CONFIG_PATH
    );

    assertEquals(result, true);

    const contacts = await readConfigContacts();
    assertEquals(contacts.includes('X: "@user1"'), true);
    assertEquals(contacts.includes('Email: "test@example.com"'), true);
    assertEquals(contacts.includes('Bluesky: "@test.bsky"'), true);
  } finally {
    await cleanup();
  }
});

Deno.test('updateContactsField: 既存の連絡先を更新', async () => {
  await setup();
  await createTestConfig("[{ X: '@olduser' }]");

  try {
    const result = await updateContactsField([{ X: '@newuser' }], TEST_CONFIG_PATH);

    assertEquals(result, true);

    const contacts = await readConfigContacts();
    assertEquals(contacts.includes('X: "@newuser"'), true);
    assertEquals(contacts.includes('@olduser'), false);
  } finally {
    await cleanup();
  }
});

Deno.test('updateContactsField: 空配列を渡した場合', async () => {
  await setup();
  await createTestConfig("[{ X: '@user' }]");

  try {
    const result = await updateContactsField([], TEST_CONFIG_PATH);

    assertEquals(result, true);

    const contacts = await readConfigContacts();
    assertEquals(contacts, '[]');
  } finally {
    await cleanup();
  }
});

Deno.test('updateContactsField: 特殊文字を含むハンドル名', async () => {
  await setup();
  await createTestConfig();

  try {
    const result = await updateContactsField([{ X: "@user's-name_123" }], TEST_CONFIG_PATH);

    assertEquals(result, true);

    const contacts = await readConfigContacts();
    assertEquals(contacts.includes('X: "@user\'s-name_123"'), true);
  } finally {
    await cleanup();
  }
});

Deno.test('updateContactsField: 複数プロパティを持つ単一オブジェクト', async () => {
  await setup();
  await createTestConfig();

  try {
    const result = await updateContactsField(
      [{ X: '@user1', Email: 'user1@example.com' }],
      TEST_CONFIG_PATH
    );

    assertEquals(result, true);

    const contacts = await readConfigContacts();
    assertEquals(contacts.includes('X: "@user1"'), true);
    assertEquals(contacts.includes('Email: "user1@example.com"'), true);
  } finally {
    await cleanup();
  }
});

Deno.test('updateContactsField: config.tsが存在しない場合にfalseを返す', async () => {
  // setup()を呼ばない（一時ディレクトリを作成しない）
  const nonExistentPath = `${TEST_DIR}/non-existent-config.ts`;

  try {
    const result = await updateContactsField([{ X: '@test' }], nonExistentPath);

    assertEquals(result, false);
  } finally {
    // クリーンアップは不要（ファイルが作成されていないため）
  }
});

Deno.test('updateConfigField: 既存フィールドを更新', async () => {
  await setup();
  await createTestConfig();

  try {
    const result = await updateConfigField('administrator', 'New Administrator', TEST_CONFIG_PATH);

    assertEquals(result, true);

    const content = await Deno.readTextFile(TEST_CONFIG_PATH);
    assertEquals(content.includes("administrator: 'New Administrator'"), true);
  } finally {
    await cleanup();
  }
});

Deno.test('updateConfigField: 新規フィールドを追加', async () => {
  await setup();
  await createTestConfig();

  try {
    const result = await updateConfigField('newField', 'newValue', TEST_CONFIG_PATH);

    assertEquals(result, true);

    const content = await Deno.readTextFile(TEST_CONFIG_PATH);
    assertEquals(content.includes("newField: 'newValue'"), true);
  } finally {
    await cleanup();
  }
});

Deno.test('updateConfigField: config.tsが存在しない場合にfalseを返す', async () => {
  const nonExistentPath = `${TEST_DIR}/non-existent-config.ts`;

  try {
    const result = await updateConfigField('administrator', 'Test', nonExistentPath);

    assertEquals(result, false);
  } finally {
    // クリーンアップは不要
  }
});

Deno.test('updateConfigFields: 複数フィールドを一度に更新', async () => {
  await setup();
  await createTestConfig();

  try {
    const result = await updateConfigFields(
      {
        administrator: 'Updated Admin',
        developedDirectoryBase: '/new/path',
      },
      TEST_CONFIG_PATH
    );

    assertEquals(result, true);

    const content = await Deno.readTextFile(TEST_CONFIG_PATH);
    assertEquals(content.includes("administrator: 'Updated Admin'"), true);
    assertEquals(content.includes("developedDirectoryBase: '/new/path'"), true);
  } finally {
    await cleanup();
  }
});

Deno.test('updateConfigFields: config.tsが存在しない場合にfalseを返す', async () => {
  const nonExistentPath = `${TEST_DIR}/non-existent-config.ts`;

  try {
    const result = await updateConfigFields({ administrator: 'Test' }, nonExistentPath);

    assertEquals(result, false);
  } finally {
    // クリーンアップは不要
  }
});

Deno.test('readConfigField: 既存フィールドを読み取る', async () => {
  await setup();
  await createTestConfig();

  try {
    const value = readConfigField('administrator', TEST_CONFIG_PATH);

    assertEquals(value, 'Test User');
  } finally {
    await cleanup();
  }
});

Deno.test('readConfigField: 存在しないフィールドを読み取るとundefinedを返す', async () => {
  await setup();
  await createTestConfig();

  try {
    const value = readConfigField('nonExistentField', TEST_CONFIG_PATH);

    assertEquals(value, undefined);
  } finally {
    await cleanup();
  }
});

Deno.test('readConfigField: config.tsが存在しない場合にundefinedを返す', async () => {
  const nonExistentPath = `${TEST_DIR}/non-existent-config.ts`;

  try {
    const value = readConfigField('administrator', nonExistentPath);

    assertEquals(value, undefined);
  } finally {
    // クリーンアップは不要
  }
});
