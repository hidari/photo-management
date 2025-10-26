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
  // macOS/Linux: 'Path/to/Your/Picture/Directory/' または '/Users/username/Pictures/'
  // Windows: 'C:\\Users\\username\\Pictures\\' または 'C:/Users/username/Pictures/'
  developedDirectoryBase: 'Path/to/Your/Picture/Directory/',

  // アーカイブ作成ツールのフルパス（オプション）
  // 未設定の場合は初回実行時に自動的にripバイナリをダウンロード・セットアップします
  // カスタムツールを使用する場合は、フルパスを指定してください
  // macOS/Linux例: archiveTool: '/Users/username/.config/photo-management/bin/rip',
  // Windows例: archiveTool: 'C:\\Users\\username\\.config\\photo-management\\bin\\rip.exe',

  // Google Drive OAuth 2.0 設定（アップロード機能を使用する場合）
  // Google Cloud Console で OAuth 2.0 クライアントIDを作成してください
  // 1. https://console.cloud.google.com/ にアクセス
  // 2. プロジェクトを作成（または既存のプロジェクトを選択）
  // 3. 「APIとサービス」→「認証情報」
  // 4. 「認証情報を作成」→「OAuth クライアントID」
  // 5. アプリケーションの種類: デスクトップアプリ
  // 6. 作成後、クライアントIDとクライアントシークレットをコピー
  googleDrive: {
    // OAuth 2.0 クライアントID
    // デスクトップアプリケーション型のクライアントIDを指定
    clientId: 'your-client-id.apps.googleusercontent.com',

    // OAuth 2.0 クライアントシークレット
    // デスクトップアプリケーション型の場合、公開されても安全な設計です
    clientSecret: 'your-client-secret',
  },
};

export default config;
