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

  // アーカイブ作成ツールのフルパス（オプション）
  // 未設定の場合は初回実行時に自動的にripバイナリをダウンロード・セットアップします
  // カスタムツールを使用する場合は、フルパスを指定してください
  // 例: archiveTool: '/Users/username/.config/photo-management/bin/rip',

  // Google Cloud 設定
  googleCloud: {
    // Google Cloud プロジェクトID
    // Google Cloud Consoleで作成したプロジェクトのIDを指定
    // このプロジェクトのAPIクォータが使用されます
    projectId: 'your-project-id',
  },
};

export default config;
