/**
 * TOML形式への出力ユーティリティ
 *
 * DistributionConfigをTOML形式の文字列に変換する機能を提供
 */

import type { DistributionConfig } from '../../types/distribution-config.ts';

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

      if (model.sns) {
        toml += `sns = "${model.sns}"\n`;
      }

      if (model.download_url) {
        toml += `download_url = "${model.download_url}"\n`;
      }

      if (model.message) {
        toml += `message = ${formatMultilineToml(model.message)}\n`;
      }

      if (model.intent_url) {
        toml += `intent_url = "${model.intent_url}"\n`;
      }

      toml += '\n';
    }
  }

  return toml;
}
