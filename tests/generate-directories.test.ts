import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { exists } from 'https://deno.land/std@0.208.0/fs/exists.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import {
  buildDirectoryStructure,
  createDirectories,
  generateReadmeFiles,
  loadTomlConfig,
  moveTomlFile,
} from '../tools/generate-directories.ts';
import { testConfig } from './helpers/test-config.ts';
import type { Event } from '../types/directory-config.ts';

/**
 * テスト用の一時ディレクトリ
 */
const TEST_DIR = './tests/tmp-dirs';

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
 * TOMLファイル読み込みの正常系テスト
 */
Deno.test('loadTomlConfig: 正常なTOMLファイルを正しくパースする', async () => {
  await cleanup();

  const tomlPath = join(TEST_DIR, 'test.toml');
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `
[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "テストモデルA"
sns = "https://twitter.com/test_a"

[[events.models]]
name = "テストモデルB"
sns = "https://twitter.com/test_b"
`;

  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  assertEquals(config.events.length, 1);
  assertEquals(config.events[0].date, '20251012');
  assertEquals(config.events[0].event_name, 'テストイベント');
  assertEquals(config.events[0].models.length, 2);
  assertEquals(config.events[0].models[0].name, 'テストモデルA');
  assertEquals(config.events[0].models[1].name, 'テストモデルB');

  await cleanup();
});

/**
 * TOMLファイル読み込みの異常系テスト
 */
Deno.test('loadTomlConfig: 存在しないファイルでエラーがスローされる', async () => {
  await cleanup();

  const nonExistentPath = join(TEST_DIR, 'non-existent.toml');

  await assertRejects(async () => {
    await loadTomlConfig(nonExistentPath);
  }, Deno.errors.NotFound);

  await cleanup();
});

/**
 * TOMLファイル読み込みの異常系テスト: eventsがない
 */
Deno.test('loadTomlConfig: eventsが定義されていないTOMLでエラーがスローされる', async () => {
  await cleanup();

  const tomlPath = join(TEST_DIR, 'invalid.toml');
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `
[some_other_section]
key = "value"
`;

  await Deno.writeTextFile(tomlPath, tomlContent);

  await assertRejects(
    async () => {
      await loadTomlConfig(tomlPath);
    },
    Error,
    'TOMLファイルにeventsが定義されていないか、空です'
  );

  await cleanup();
});

/**
 * ディレクトリ構造構築のテスト
 */
Deno.test('buildDirectoryStructure: イベント情報から正しいディレクトリ構造を構築する', () => {
  const event: Event = {
    date: '20251012',
    event_name: 'アコスタATC',
    models: [
      { name: 'Aさん', sns: 'https://twitter.com/a' },
      { name: 'Bさん', sns: 'https://twitter.com/b' },
    ],
  };

  const structure = buildDirectoryStructure(event, testConfig);

  // ベースディレクトリとイベントディレクトリの確認
  assertEquals(structure.baseDir, testConfig.developedDirectoryBase);
  assertEquals(structure.eventDir, join(testConfig.developedDirectoryBase, '20251012_アコスタATC'));

  // モデルディレクトリの確認
  assertEquals(structure.models.length, 2);

  // 1人目のモデル
  assertEquals(structure.models[0].modelName, 'Aさん');
  assertEquals(
    structure.models[0].modelDir,
    join(testConfig.developedDirectoryBase, '20251012_アコスタATC', 'Aさん')
  );
  assertEquals(
    structure.models[0].distDir,
    join(testConfig.developedDirectoryBase, '20251012_アコスタATC', 'Aさん', '20251012_アコスタATC_テスト太郎撮影_Aさん')
  );
  assertEquals(
    structure.models[0].readmePath,
    join(
      testConfig.developedDirectoryBase,
      '20251012_アコスタATC',
      'Aさん',
      '20251012_アコスタATC_テスト太郎撮影_Aさん',
      '_README.txt'
    )
  );

  // 2人目のモデル
  assertEquals(structure.models[1].modelName, 'Bさん');
});

/**
 * ディレクトリ作成のテスト
 */
Deno.test('createDirectories: ディレクトリ構造を実際に作成する', async () => {
  await cleanup();

  const event: Event = {
    date: '20251012',
    event_name: 'テストイベント',
    models: [{ name: 'テストモデル', sns: 'https://twitter.com/test' }],
  };

  // テスト用のbaseDirectoryを使用
  const testConfigLocal = { ...testConfig, developedDirectoryBase: TEST_DIR };
  const structure = buildDirectoryStructure(event, testConfigLocal);

  await createDirectories(structure);

  // ディレクトリが作成されたことを確認
  const eventDirExists = await exists(structure.eventDir);
  assertEquals(eventDirExists, true);

  const modelDirExists = await exists(structure.models[0].modelDir);
  assertEquals(modelDirExists, true);

  const distDirExists = await exists(structure.models[0].distDir);
  assertEquals(distDirExists, true);

  await cleanup();
});

/**
 * READMEファイル生成のテスト
 */
Deno.test('generateReadmeFiles: 各配布ディレクトリにREADMEファイルを生成する', async () => {
  await cleanup();

  const event: Event = {
    date: '20251012',
    event_name: 'テストイベント',
    models: [
      { name: 'モデルA', sns: 'https://twitter.com/a' },
      { name: 'モデルB', sns: 'https://twitter.com/b' },
    ],
  };

  // テスト用のテンプレートを作成
  const templatePath = join(TEST_DIR, 'test-template.eta');
  await Deno.mkdir(TEST_DIR, { recursive: true });
  await Deno.writeTextFile(templatePath, '撮影者: <%= it.administrator %>');

  // ディレクトリ構造を作成
  const testConfigLocal = { ...testConfig, developedDirectoryBase: TEST_DIR };
  const structure = buildDirectoryStructure(event, testConfigLocal);
  await createDirectories(structure);

  // READMEファイルを生成
  await generateReadmeFiles(structure, testConfigLocal, templatePath);

  // 各モデルのREADMEファイルが作成されたことを確認
  for (const model of structure.models) {
    const readmeExists = await exists(model.readmePath);
    assertEquals(readmeExists, true);

    const content = await Deno.readTextFile(model.readmePath);
    assertEquals(content, '撮影者: テスト太郎');
  }

  await cleanup();
});

/**
 * TOMLファイル移動のテスト
 */
Deno.test('moveTomlFile: TOMLファイルを指定ディレクトリに移動する', async () => {
  await cleanup();

  // 元のTOMLファイルを作成
  const sourcePath = join(TEST_DIR, 'source.toml');
  const destDir = join(TEST_DIR, 'destination');

  await Deno.mkdir(TEST_DIR, { recursive: true });
  await Deno.mkdir(destDir, { recursive: true });
  await Deno.writeTextFile(sourcePath, '# test toml');

  // ファイルを移動
  await moveTomlFile(sourcePath, destDir);

  // 移動先にファイルが存在することを確認
  const destPath = join(destDir, 'source.toml');
  const destExists = await exists(destPath);
  assertEquals(destExists, true);

  // 元の場所にファイルが存在しないことを確認
  const sourceExists = await exists(sourcePath);
  assertEquals(sourceExists, false);

  // 内容が保持されていることを確認
  const content = await Deno.readTextFile(destPath);
  assertEquals(content, '# test toml');

  await cleanup();
});

/**
 * 複数イベントを含むTOMLのテスト
 */
Deno.test('loadTomlConfig: 複数イベントを含むTOMLファイルを正しくパースする', async () => {
  await cleanup();

  const tomlPath = join(TEST_DIR, 'multi-events.toml');
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `
[[events]]
date = "20251012"
event_name = "イベント1"

[[events.models]]
name = "モデルA"
sns = "https://twitter.com/a"

[[events]]
date = "20251013"
event_name = "イベント2"

[[events.models]]
name = "モデルB"
sns = "https://twitter.com/b"
`;

  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  assertEquals(config.events.length, 2);
  assertEquals(config.events[0].event_name, 'イベント1');
  assertEquals(config.events[1].event_name, 'イベント2');

  await cleanup();
});
