/**
 * TOML書き込みライブラリのテスト
 */

import { assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { configToToml, updateModelFields } from '../tools/lib/toml-writer.ts';
import type { DistributionConfig } from '../types/distribution-config.ts';

/**
 * configToToml: 基本的な設定をTOML形式に変換
 */
Deno.test('configToToml: 基本的な設定をTOML形式に変換する', () => {
  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [
          { name: 'モデルA', outreach: true },
          { name: 'モデルB', outreach: false },
        ],
      },
    ],
  };

  const toml = configToToml(config);

  assertStringIncludes(toml, 'date = "20251012"');
  assertStringIncludes(toml, 'event_name = "テストイベント"');
  assertStringIncludes(toml, 'name = "モデルA"');
  assertStringIncludes(toml, 'outreach = true');
  assertStringIncludes(toml, 'name = "モデルB"');
  assertStringIncludes(toml, 'outreach = false');
});

/**
 * configToToml: SNS付きモデルをTOML形式に変換
 */
Deno.test('configToToml: SNS付きモデルをTOML形式に変換する', () => {
  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [{ name: 'モデルA', outreach: true, sns: 'https://x.com/modelA' }],
      },
    ],
  };

  const toml = configToToml(config);

  assertStringIncludes(toml, 'sns = "https://x.com/modelA"');
});

/**
 * configToToml: download_url付きモデルをTOML形式に変換
 */
Deno.test('configToToml: download_url付きモデルをTOML形式に変換する', () => {
  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [
          {
            name: 'モデルA',
            outreach: true,
            download_url: 'https://drive.google.com/file/d/xyz',
          },
        ],
      },
    ],
  };

  const toml = configToToml(config);

  assertStringIncludes(toml, 'download_url = "https://drive.google.com/file/d/xyz"');
});

/**
 * configToToml: message付きモデルをTOML形式に変換
 */
Deno.test('configToToml: message付きモデルをTOML形式に変換する', () => {
  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'テストイベント',
        models: [
          {
            name: 'モデルA',
            outreach: true,
            message: 'こんにちは、写真をお送りします。',
          },
        ],
      },
    ],
  };

  const toml = configToToml(config);

  assertStringIncludes(toml, 'こんにちは、写真をお送りします。');
});

/**
 * configToToml: 空のモデルリストをTOML形式に変換
 */
Deno.test('configToToml: 空のモデルリストをTOML形式に変換する', () => {
  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'モデルなしイベント',
        models: [],
      },
    ],
  };

  const toml = configToToml(config);

  assertStringIncludes(toml, 'date = "20251012"');
  assertStringIncludes(toml, 'event_name = "モデルなしイベント"');
});

/**
 * configToToml: 複数イベントをTOML形式に変換
 */
Deno.test('configToToml: 複数イベントをTOML形式に変換する', () => {
  const config: DistributionConfig = {
    events: [
      {
        date: '20251012',
        event_name: 'イベント1',
        models: [{ name: 'モデルA', outreach: true }],
      },
      {
        date: '20251013',
        event_name: 'イベント2',
        models: [{ name: 'モデルB', outreach: false }],
      },
    ],
  };

  const toml = configToToml(config);

  assertStringIncludes(toml, 'date = "20251012"');
  assertStringIncludes(toml, 'event_name = "イベント1"');
  assertStringIncludes(toml, 'name = "モデルA"');
  assertStringIncludes(toml, 'date = "20251013"');
  assertStringIncludes(toml, 'event_name = "イベント2"');
  assertStringIncludes(toml, 'name = "モデルB"');
});

/**
 * updateModelFields: モデルのフィールドを更新する
 */
Deno.test('updateModelFields: モデルのdownload_urlを更新する', async () => {
  const tomlContent = `[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "モデルA"
outreach = true
`;

  // 一時ファイルに書き込み
  const tempPath = './tests/tmp-toml/test.toml';
  await Deno.mkdir('./tests/tmp-toml', { recursive: true });
  await Deno.writeTextFile(tempPath, tomlContent);

  // フィールド更新
  const updatedToml = await updateModelFields(tempPath, 'モデルA', {
    download_url: 'https://drive.google.com/file/d/xyz',
  });

  // 更新内容確認
  assertStringIncludes(updatedToml, 'download_url = "https://drive.google.com/file/d/xyz"');
  assertStringIncludes(updatedToml, 'name = "モデルA"');
  assertStringIncludes(updatedToml, 'outreach = true');

  // クリーンアップ
  await Deno.remove('./tests/tmp-toml', { recursive: true });
});

/**
 * updateModelFields: モデルのmessageを更新する
 */
Deno.test('updateModelFields: モデルのmessageを更新する', async () => {
  const tomlContent = `[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "モデルA"
outreach = true
`;

  // 一時ファイルに書き込み
  const tempPath = './tests/tmp-toml/test2.toml';
  await Deno.mkdir('./tests/tmp-toml', { recursive: true });
  await Deno.writeTextFile(tempPath, tomlContent);

  // フィールド更新
  const updatedToml = await updateModelFields(tempPath, 'モデルA', {
    message: 'こんにちは、写真をお送りします。',
  });

  // 更新内容確認
  assertStringIncludes(updatedToml, 'こんにちは、写真をお送りします。');

  // クリーンアップ
  await Deno.remove('./tests/tmp-toml', { recursive: true });
});

/**
 * updateModelFields: 複数フィールドを同時に更新する
 */
Deno.test('updateModelFields: 複数フィールドを同時に更新する', async () => {
  const tomlContent = `[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "モデルA"
outreach = true
`;

  // 一時ファイルに書き込み
  const tempPath = './tests/tmp-toml/test3.toml';
  await Deno.mkdir('./tests/tmp-toml', { recursive: true });
  await Deno.writeTextFile(tempPath, tomlContent);

  // 複数フィールド更新
  const updatedToml = await updateModelFields(tempPath, 'モデルA', {
    download_url: 'https://drive.google.com/file/d/xyz',
    message: 'こんにちは',
    distributed: true,
  });

  // 更新内容確認
  assertStringIncludes(updatedToml, 'download_url = "https://drive.google.com/file/d/xyz"');
  assertStringIncludes(updatedToml, 'こんにちは');
  assertStringIncludes(updatedToml, 'distributed = true');

  // クリーンアップ
  await Deno.remove('./tests/tmp-toml', { recursive: true });
});

/**
 * updateTomlWithUrls: TOMLファイルに共有URLを記録
 */
Deno.test('updateTomlWithUrls: TOMLファイルに共有URLを記録する', async () => {
  const tomlContent = `[[events]]
date = "20251012"
event_name = "テストイベント"

[[events.models]]
name = "モデルA"
outreach = true
`;

  const tomlPath = './tests/tmp-toml/test-urls.toml';
  await Deno.mkdir('./tests/tmp-toml', { recursive: true });
  await Deno.writeTextFile(tomlPath, tomlContent);

  // URLマップを作成
  const urlMap = new Map<string, string>();
  urlMap.set('モデルA', 'https://drive.google.com/file/d/xyz');

  // URLを更新
  const { updateTomlWithUrls } = await import('../tools/lib/toml-writer.ts');
  await updateTomlWithUrls(tomlPath, urlMap);

  // ファイルを読み込んで確認
  const updatedContent = await Deno.readTextFile(tomlPath);
  assertStringIncludes(updatedContent, 'download_url = "https://drive.google.com/file/d/xyz"');

  // クリーンアップ
  await Deno.remove('./tests/tmp-toml', { recursive: true });
});
