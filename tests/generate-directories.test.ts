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
import type { Event } from '../types/distribution-config.ts';
import { testConfig } from './helpers/test-config.ts';

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
      { name: 'Aさん', outreach: false, sns: 'https://twitter.com/a' },
      { name: 'Bさん', outreach: false, sns: 'https://twitter.com/b' },
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
    join(testConfig.developedDirectoryBase, '20251012_アコスタATC', 'Aさんさん')
  );
  assertEquals(
    structure.models[0].distDir,
    join(
      testConfig.developedDirectoryBase,
      '20251012_アコスタATC',
      'Aさんさん',
      '20251012_アコスタATC_テスト太郎撮影_Aさんさん'
    )
  );
  assertEquals(
    structure.models[0].readmePath,
    join(
      testConfig.developedDirectoryBase,
      '20251012_アコスタATC',
      'Aさんさん',
      '20251012_アコスタATC_テスト太郎撮影_Aさんさん',
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
    models: [{ name: 'テストモデル', outreach: false, sns: 'https://twitter.com/test' }],
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
      { name: 'モデルA', outreach: false, sns: 'https://twitter.com/a' },
      { name: 'モデルB', outreach: false, sns: 'https://twitter.com/b' },
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

/**
 * createDirectoriesのテスト: 既に存在するディレクトリ
 */
Deno.test('createDirectories: 既に存在するディレクトリでもエラーにならない', async () => {
  await cleanup();

  const event: Event = {
    date: '20251012',
    event_name: 'テストイベント',
    models: [{ name: 'テストモデル', outreach: false, sns: 'https://twitter.com/test' }],
  };

  const testConfigLocal = { ...testConfig, developedDirectoryBase: TEST_DIR };
  const structure = buildDirectoryStructure(event, testConfigLocal);

  // 1回目の作成
  await createDirectories(structure);

  // 2回目の作成（既に存在する）
  await createDirectories(structure);

  // エラーにならず、ディレクトリが存在することを確認
  const distDirExists = await exists(structure.models[0].distDir);
  assertEquals(distDirExists, true);

  await cleanup();
});

/**
 * moveTomlFileのテスト: ファイル名が保持される
 */
Deno.test('moveTomlFile: 元のファイル名が保持される', async () => {
  await cleanup();

  const sourcePath = join(TEST_DIR, 'custom-name.toml');
  const destDir = join(TEST_DIR, 'destination');

  await Deno.mkdir(TEST_DIR, { recursive: true });
  await Deno.mkdir(destDir, { recursive: true });
  await Deno.writeTextFile(sourcePath, '# test toml');

  await moveTomlFile(sourcePath, destDir);

  // 移動先にcustom-name.tomlとして存在することを確認
  const destPath = join(destDir, 'custom-name.toml');
  const destExists = await exists(destPath);
  assertEquals(destExists, true);

  await cleanup();
});

/**
 * loadTomlConfigの拡張テスト: 日本語・絵文字を含むデータ
 */
Deno.test('loadTomlConfig: 日本語・絵文字を含むイベント名とモデル名を正しくパースする', async () => {
  await cleanup();

  const tomlPath = join(TEST_DIR, 'japanese-emoji.toml');
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `
[[events]]
date = "20251012"
event_name = "コミックマーケット105 🎉"

[[events.models]]
name = "田中 花子 🌸"
sns = "https://twitter.com/hanako"

[[events.models]]
name = "山田太郎"
sns = "https://twitter.com/taro"
`;

  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  assertEquals(config.events.length, 1);
  assertEquals(config.events[0].event_name, 'コミックマーケット105 🎉');
  assertEquals(config.events[0].models[0].name, '田中 花子 🌸');
  assertEquals(config.events[0].models[1].name, '山田太郎');

  await cleanup();
});

/**
 * loadTomlConfigの拡張テスト: 重複するモデル名
 */
Deno.test('loadTomlConfig: 重複するモデル名を含むTOMLを正しくパースする', async () => {
  await cleanup();

  const tomlPath = join(TEST_DIR, 'duplicate-models.toml');
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `
[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "Aさん"
sns = "https://twitter.com/a1"

[[events.models]]
name = "Aさん"
sns = "https://twitter.com/a2"
`;

  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  // パースは成功するが、重複は許容される（ビジネスロジック側で処理）
  assertEquals(config.events[0].models.length, 2);
  assertEquals(config.events[0].models[0].name, 'Aさん');
  assertEquals(config.events[0].models[1].name, 'Aさん');

  await cleanup();
});

/**
 * loadTomlConfigの拡張テスト: SNSフィールドがオプショナル
 */
Deno.test('loadTomlConfig: SNSフィールドがないモデルを正しくパースする', async () => {
  await cleanup();

  const tomlPath = join(TEST_DIR, 'no-sns.toml');
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `
[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "プライベートモデル"
`;

  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  assertEquals(config.events[0].models[0].name, 'プライベートモデル');
  assertEquals(config.events[0].models[0].sns, undefined);

  await cleanup();
});

/**
 * loadTomlConfigの拡張テスト: 空のmodels配列
 */
Deno.test('loadTomlConfig: models配列が空のイベントを含むTOMLをパースする', async () => {
  await cleanup();

  const tomlPath = join(TEST_DIR, 'empty-models.toml');
  await Deno.mkdir(TEST_DIR, { recursive: true });

  const tomlContent = `
[[events]]
date = "20251012"
event_name = "モデルなしイベント"
models = []
`;

  await Deno.writeTextFile(tomlPath, tomlContent);

  const config = await loadTomlConfig(tomlPath);

  // パースは成功し、空の配列として扱われる
  assertEquals(config.events[0].models.length, 0);

  await cleanup();
});

/**
 * buildDirectoryStructureの拡張テスト: 日本語・特殊文字を含むパス生成
 */
Deno.test('buildDirectoryStructure: 日本語・特殊文字を含むイベント名とモデル名で正しいパスを生成する', () => {
  const event: Event = {
    date: '20251012',
    event_name: 'コミケ 105',
    models: [
      { name: '田中 花子', outreach: false, sns: 'https://twitter.com/hanako' },
      { name: 'スペース　テスト', outreach: false, sns: 'https://twitter.com/space' },
    ],
  };

  const structure = buildDirectoryStructure(event, testConfig);

  // イベントディレクトリパスの確認
  assertEquals(structure.eventDir, join(testConfig.developedDirectoryBase, '20251012_コミケ 105'));

  // 1人目のモデル（日本語）
  assertEquals(structure.models[0].modelName, '田中 花子');
  assertEquals(
    structure.models[0].distDir,
    join(
      testConfig.developedDirectoryBase,
      '20251012_コミケ 105',
      '田中 花子さん',
      '20251012_コミケ 105_テスト太郎撮影_田中 花子さん'
    )
  );

  // 2人目のモデル（全角スペース）
  assertEquals(structure.models[1].modelName, 'スペース　テスト');
});

/**
 * buildDirectoryStructureの拡張テスト: 絵文字を含むパス生成
 */
Deno.test('buildDirectoryStructure: 絵文字を含むイベント名とモデル名で正しいパスを生成する', () => {
  const event: Event = {
    date: '20251012',
    event_name: 'アニメフェス 🎉',
    models: [{ name: 'モデル 🌸', outreach: false, sns: 'https://twitter.com/model' }],
  };

  const structure = buildDirectoryStructure(event, testConfig);

  assertEquals(
    structure.eventDir,
    join(testConfig.developedDirectoryBase, '20251012_アニメフェス 🎉')
  );

  assertEquals(structure.models[0].modelName, 'モデル 🌸');
  assertEquals(
    structure.models[0].readmePath,
    join(
      testConfig.developedDirectoryBase,
      '20251012_アニメフェス 🎉',
      'モデル 🌸さん',
      '20251012_アニメフェス 🎉_テスト太郎撮影_モデル 🌸さん',
      '_README.txt'
    )
  );
});

/**
 * buildDirectoryStructureの拡張テスト: 長いモデル名
 */
Deno.test('buildDirectoryStructure: 64文字を超える長いモデル名で正しいパスを生成する', () => {
  const longName = 'とても長いモデル名'.repeat(10); // 100文字以上

  const event: Event = {
    date: '20251012',
    event_name: 'テストイベント',
    models: [{ name: longName, outreach: false, sns: 'https://twitter.com/long' }],
  };

  const structure = buildDirectoryStructure(event, testConfig);

  // パスが正しく生成されることを確認（OSの制限には依存しない）
  assertEquals(structure.models[0].modelName, longName);
  assertEquals(
    structure.models[0].distDir,
    join(
      testConfig.developedDirectoryBase,
      '20251012_テストイベント',
      `${longName}さん`,
      `20251012_テストイベント_テスト太郎撮影_${longName}さん`
    )
  );
});

/**
 * buildDirectoryStructureの拡張テスト: administratorに日本語を含む場合
 */
Deno.test('buildDirectoryStructure: administrator名に日本語を含む場合に正しいパスを生成する', () => {
  const japaneseAdminConfig = {
    ...testConfig,
    administrator: '山田 太郎',
  };

  const event: Event = {
    date: '20251012',
    event_name: 'テストイベント',
    models: [{ name: 'モデルA', outreach: false, sns: 'https://twitter.com/a' }],
  };

  const structure = buildDirectoryStructure(event, japaneseAdminConfig);

  assertEquals(
    structure.models[0].distDir,
    join(
      japaneseAdminConfig.developedDirectoryBase,
      '20251012_テストイベント',
      'モデルAさん',
      '20251012_テストイベント_山田 太郎撮影_モデルAさん'
    )
  );
});

/**
 * buildDirectoryStructureの拡張テスト: distDirとreadmePathの相対関係
 */
Deno.test('buildDirectoryStructure: distDirとreadmePathの相対関係が常に正しい', () => {
  const event: Event = {
    date: '20251012',
    event_name: 'テストイベント',
    models: [
      { name: 'モデルA', outreach: false, sns: 'https://twitter.com/a' },
      { name: 'モデルB', outreach: false, sns: 'https://twitter.com/b' },
    ],
  };

  const structure = buildDirectoryStructure(event, testConfig);

  // 各モデルのreadmePathがdistDir内に存在することを確認
  for (const model of structure.models) {
    const expectedReadmePath = join(model.distDir, '_README.txt');
    assertEquals(model.readmePath, expectedReadmePath);
  }
});

/**
 * loadTomlConfigのエッジケーステスト: 無効なTOML構文でエラーを投げる
 */
Deno.test('loadTomlConfig: 無効なTOML構文でエラーを投げる', async () => {
  await cleanup();

  await Deno.mkdir(TEST_DIR, { recursive: true });

  // 無効なTOMLファイルを作成（閉じクォートがない）
  const tomlPath = join(TEST_DIR, 'invalid.toml');
  await Deno.writeTextFile(
    tomlPath,
    `[[events]]
date = "20251012
event_name = "テストイベント"
`
  );

  try {
    await loadTomlConfig(tomlPath);
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    assertEquals(error instanceof Error, true);
  } finally {
    await cleanup();
  }
});

/**
 * loadTomlConfigのエッジケーステスト: 必須フィールドが欠けている場合
 */
Deno.test('loadTomlConfig: dateフィールドが欠けている場合も正常にパースする', async () => {
  await cleanup();

  await Deno.mkdir(TEST_DIR, { recursive: true });

  // dateフィールドがないTOMLファイルを作成
  const tomlPath = join(TEST_DIR, 'no-date.toml');
  await Deno.writeTextFile(
    tomlPath,
    `[[events]]
event_name = "テストイベント"

[[events.models]]
name = "モデルA"
sns = "https://twitter.com/a"
`
  );

  // loadTomlConfig自体はeventsの存在のみを検証する
  // 個別フィールドのバリデーションは行わない
  const config = await loadTomlConfig(tomlPath);
  assertEquals(config.events.length, 1);
  assertEquals(config.events[0].event_name, 'テストイベント');

  await cleanup();
});

/**
 * buildDirectoryStructureの境界値テスト: models配列が空の場合
 */
Deno.test('buildDirectoryStructure: models配列が空の場合空のmodelDirectoriesを返す', () => {
  const event: Event = {
    date: '20251012',
    event_name: 'テストイベント',
    models: [],
  };

  const structure = buildDirectoryStructure(event, testConfig);

  assertEquals(structure.models.length, 0);
  assertEquals(structure.baseDir, testConfig.developedDirectoryBase);
  assertEquals(
    structure.eventDir,
    join(testConfig.developedDirectoryBase, '20251012_テストイベント')
  );
});
