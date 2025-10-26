import type { Config } from '../../types/config.ts';

/**
 * テスト用の設定データ
 * 実際の設定ファイルとは独立しており、テストの再現性を保証する
 */
export const testConfig: Config = {
  administrator: 'テスト太郎',
  contacts: [{ X: '@test_user' }, { Bluesky: '@test.bsky.social' }],
  developedDirectoryBase: '/tmp/test-photos/',
  googleDrive: {
    clientId: 'test-client-id.apps.googleusercontent.com',
    clientSecret: 'test-client-secret',
  },
};

/**
 * 最小限の設定データ
 * 必須フィールドのみを含む
 */
export const minimalConfig: Config = {
  administrator: 'Minimal User',
  contacts: [{ Email: 'test@example.com' }],
  developedDirectoryBase: '/tmp/minimal/',
  googleDrive: {
    clientId: 'minimal-client-id.apps.googleusercontent.com',
    clientSecret: 'minimal-client-secret',
  },
};
