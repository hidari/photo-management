/**
 * TOML形式への出力ユーティリティ
 *
 * DistributionConfigをTOML形式の文字列に変換する機能を提供
 */

import type { DistributionConfig, EventModel } from '../../types/distribution-config.ts';
import { loadTomlConfig } from './config-loader.ts';

/**
 * TOMLファイルの複数行リテラル文字列をフォーマットする
 *
 * @param text - フォーマットする文字列
 * @returns 複数行リテラル文字列形式の文字列
 */
function formatMultilineToml(text: string): string {
  // 文字列の前後の空白を削除し、改行を正規化
  const normalized = text.trim().replace(/\r\n/g, '\n');
  return `'''\n${normalized}\n'''`;
}

/**
 * DistributionConfigをTOML形式の文字列に変換する
 *
 * @param config - ディレクトリ設定
 * @returns TOML形式の文字列
 */
export function configToToml(config: DistributionConfig): string {
  let toml = '# イベント用ディレクトリ構造作成の設定ファイル\n\n';

  for (const event of config.events) {
    toml += '[[events]]\n';
    toml += `date = "${event.date}"\n`;
    toml += `event_name = "${event.event_name}"\n\n`;

    for (const model of event.models) {
      toml += '[[events.models]]\n';
      toml += `name = "${model.name}"\n`;
      toml += `outreach = ${model.outreach}\n`;
      toml += `sns = "${model.sns || ''}"\n`;
      toml += `download_url = "${model.download_url || ''}"\n`;
      toml += `message = ${formatMultilineToml(model.message || '')}\n`;
      toml += `intent_url = "${model.intent_url || ''}"\n`;
      toml += `distributed = ${model.distributed ?? false}\n`;

      toml += '\n';
    }
  }

  return toml;
}

/**
 * 既存のtomlファイルを読み込み、特定モデルのフィールドを部分更新する
 *
 * @param tomlPath - 更新対象のtomlファイルのパス
 * @param modelName - 更新対象のモデル名
 * @param fields - 更新するフィールドとその値
 * @returns 更新後のTOML文字列
 */
export async function updateModelFields(
  tomlPath: string,
  modelName: string,
  fields: Partial<EventModel>
): Promise<string> {
  // 既存のtomlファイルを読み込み
  const config = await loadTomlConfig(tomlPath);

  // 対象モデルを検索して更新
  let modelFound = false;
  for (const event of config.events) {
    for (const model of event.models) {
      if (model.name === modelName) {
        Object.assign(model, fields);
        modelFound = true;
        break;
      }
    }
    if (modelFound) break;
  }

  if (!modelFound) {
    throw new Error(`モデル "${modelName}" が見つかりません。`);
  }

  // 更新後の設定をTOML形式に変換
  return configToToml(config);
}

/**
 * TOMLファイルに配布メッセージを追記する
 *
 * @param tomlPath - TOMLファイルのパス
 * @param directoryConfig - ディレクトリ設定
 * @param renderModelTemplate - モデル用テンプレートレンダリング関数
 */
export async function updateTomlWithMessages(
  tomlPath: string,
  directoryConfig: DistributionConfig,
  renderModelTemplate: (
    templatePath: string,
    modelName: string,
    eventName: string,
    downloadUrl: string
  ) => Promise<string>
): Promise<void> {
  // 各モデルのメッセージを生成
  let skippedCount = 0;
  for (const event of directoryConfig.events) {
    for (const model of event.models) {
      // download_urlが存在しない場合はスキップ
      if (!model.download_url) {
        console.warn(`   ⚠️  スキップ: モデル「${model.name}」のdownload_urlが未設定です`);
        skippedCount++;
        continue;
      }

      // outreachフィールドに応じてテンプレートを選択
      const templatePath = model.outreach
        ? './templates/MODEL_OUTREACH.eta'
        : './templates/MODEL_FOLLOW_UP.eta';

      // テンプレートをレンダリング
      // messageフィールドに設定
      model.message = await renderModelTemplate(
        templatePath,
        model.name,
        event.event_name,
        model.download_url
      );
    }
  }

  // スキップした場合は情報メッセージを追加
  if (skippedCount > 0) {
    console.log(`\n   💡 download_urlが未設定のモデル${skippedCount}件をスキップしました`);
    console.log(`   先に「deno task upload」を実行してからもう一度お試しください\n`);
  }

  // TOMLファイルに書き込み
  const tomlContent = configToToml(directoryConfig);
  await Deno.writeTextFile(tomlPath, tomlContent);
}

/**
 * TOMLファイルを更新して共有URLを記録する
 *
 * @param tomlPath - TOMLファイルのパス
 * @param urlMap - モデル名と共有URLのマップ
 */
export async function updateTomlWithUrls(
  tomlPath: string,
  urlMap: Map<string, string>
): Promise<void> {
  // TOMLファイルを読み込む
  const config = await loadTomlConfig(tomlPath);

  // URLを更新
  for (const event of config.events) {
    for (const model of event.models) {
      const url = urlMap.get(model.name);
      if (url) {
        model.download_url = url;
      }
    }
  }

  // TOMLファイルに書き戻す
  const tomlContent = configToToml(config);
  await Deno.writeTextFile(tomlPath, tomlContent);
}
