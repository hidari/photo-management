/**
 * このファイルはExampleです。
 *
 * `config.ts` としてコピーし、プレースホルダーを適切な値に変更してください。
 */

import type { Config } from './types/config.ts';

export const config: Config = {
  // 名前
  administrator: '<YOUR_NAME>',

  // 連絡先となるプラットフォームのアカウント（任意のプラットフォームを追加・削除可能）
  contacts: [{ X: '@<YOUR_ACCOUNT_ID>' }, { Bluesky: '@<YOUR_ACCOUNT_ID>' }],

  // 現像済み画像ディレクトリのパス
  developedDirectoryBase: 'Path/to/Your/Picture/Directory/',
};

export default config;
