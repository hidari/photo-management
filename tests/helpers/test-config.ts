import type { Config } from '../../types/config.ts';

/**
 * テスト用の設定データ
 * 実際の設定ファイルとは独立しており、テストの再現性を保証する
 */
export const testConfig: Config = {
  administrator: 'テスト太郎',
  contacts: [{ X: '@test_user' }, { Bluesky: '@test.bsky.social' }],
  developedDirectoryBase: '/tmp/test-photos/',
  googleCloud: {
    projectId: 'test-project-id',
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
  googleCloud: {
    projectId: 'minimal-project-id',
  },
};
