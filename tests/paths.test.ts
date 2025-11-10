/**
 * paths.tsのテスト
 * パス関連ユーティリティのテスト
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  getConfigDir,
  getDefaultPicturesDirectory,
  getHomeDirectory,
  getTokenPath,
} from '../tools/lib/paths.ts';

// ========================================
// getHomeDirectory のテスト
// ========================================

Deno.test('getHomeDirectory: ホームディレクトリを取得する', () => {
  const home = getHomeDirectory();

  // 実際の環境変数が設定されている場合は文字列が返る
  if (home !== undefined) {
    assertEquals(typeof home, 'string');
    // 空文字列ではないことを確認
    assertEquals(home.length > 0, true);
  }
});

// ========================================
// getDefaultPicturesDirectory のテスト
// ========================================

Deno.test('getDefaultPicturesDirectory: デフォルト写真ディレクトリを取得する', () => {
  const picturesDir = getDefaultPicturesDirectory();

  // 文字列が返ることを確認
  assertEquals(typeof picturesDir, 'string');

  // 空文字列ではないことを確認
  assertEquals(picturesDir.length > 0, true);

  // OS別の確認
  const os = Deno.build.os;
  if (os === 'windows') {
    // Windowsの場合は \Pictures が含まれる
    assertEquals(picturesDir.includes('\\Pictures'), true);
  } else {
    // macOS/Linuxの場合は /Pictures が含まれる
    assertEquals(picturesDir.includes('/Pictures'), true);
  }
});

Deno.test('getDefaultPicturesDirectory: 実際の環境でホームディレクトリが展開される', () => {
  const home = getHomeDirectory();
  const picturesDir = getDefaultPicturesDirectory();

  // ホームディレクトリが取得できる場合は、Pictures配下のパスが返る
  if (home !== undefined) {
    const os = Deno.build.os;
    if (os === 'windows') {
      assertEquals(picturesDir, `${home}\\Pictures`);
    } else {
      assertEquals(picturesDir, `${home}/Pictures`);
    }
  } else {
    // ホームディレクトリが取得できない場合はフォールバック値が返る
    const os = Deno.build.os;
    if (os === 'windows') {
      assertEquals(picturesDir, 'C:\\Users\\your_name\\Pictures');
    } else {
      assertEquals(picturesDir, '/Users/your_name/Pictures');
    }
  }
});

Deno.test('getDefaultPicturesDirectory: フォールバック動作をテスト', async () => {
  // 環境変数を一時的にクリアしてテスト
  const os = Deno.build.os;
  const envKey = os === 'windows' ? 'USERPROFILE' : 'HOME';
  const originalValue = Deno.env.get(envKey);

  try {
    // 環境変数を削除
    Deno.env.delete(envKey);

    const picturesDir = getDefaultPicturesDirectory();

    // フォールバック値が返ることを確認
    if (os === 'windows') {
      assertEquals(picturesDir, 'C:\\Users\\your_name\\Pictures');
    } else {
      assertEquals(picturesDir, '/Users/your_name/Pictures');
    }
  } finally {
    // 環境変数を復元
    if (originalValue !== undefined) {
      Deno.env.set(envKey, originalValue);
    }
  }
});

// ========================================
// getConfigDir のテスト
// ========================================

Deno.test('getConfigDir: HOME環境変数がある場合、正しいパスを返す', () => {
  const originalHome = Deno.env.get('HOME');
  const originalUserProfile = Deno.env.get('USERPROFILE');

  try {
    // HOME環境変数を設定
    Deno.env.set('HOME', '/Users/testuser');
    if (originalUserProfile !== undefined) {
      Deno.env.delete('USERPROFILE');
    }

    const configDir = getConfigDir();

    assertEquals(configDir, '/Users/testuser/.config/photo-management');
  } finally {
    // 環境変数を復元
    if (originalHome !== undefined) {
      Deno.env.set('HOME', originalHome);
    } else {
      Deno.env.delete('HOME');
    }
    if (originalUserProfile !== undefined) {
      Deno.env.set('USERPROFILE', originalUserProfile);
    }
  }
});

Deno.test('getConfigDir: 環境変数がない場合、空文字ベースのパスを返す', () => {
  const originalHome = Deno.env.get('HOME');
  const originalUserProfile = Deno.env.get('USERPROFILE');

  try {
    // 両方の環境変数を削除
    if (originalHome !== undefined) {
      Deno.env.delete('HOME');
    }
    if (originalUserProfile !== undefined) {
      Deno.env.delete('USERPROFILE');
    }

    const configDir = getConfigDir();

    // 空文字から始まるパスになる
    assertEquals(configDir, '.config/photo-management');
  } finally {
    // 環境変数を復元
    if (originalHome !== undefined) {
      Deno.env.set('HOME', originalHome);
    }
    if (originalUserProfile !== undefined) {
      Deno.env.set('USERPROFILE', originalUserProfile);
    }
  }
});

Deno.test('getConfigDir: パスの形式が正しい', () => {
  const configDir = getConfigDir();

  // .config/photo-management で終わることを確認
  assertStringIncludes(configDir, '.config');
  assertStringIncludes(configDir, 'photo-management');
});

// ========================================
// getTokenPath のテスト
// ========================================

Deno.test('getTokenPath: 正しいトークンファイルパスを返す', () => {
  const tokenPath = getTokenPath();

  // トークンファイル名が含まれていることを確認
  assertStringIncludes(tokenPath, 'google-drive-token.json');
  assertStringIncludes(tokenPath, '.config');
  assertStringIncludes(tokenPath, 'photo-management');
});

Deno.test('getTokenPath: パスの形式が {configDir}/google-drive-token.json になっている', () => {
  const originalHome = Deno.env.get('HOME');

  try {
    Deno.env.set('HOME', '/Users/testuser');

    const tokenPath = getTokenPath();

    assertEquals(tokenPath, '/Users/testuser/.config/photo-management/google-drive-token.json');
  } finally {
    if (originalHome !== undefined) {
      Deno.env.set('HOME', originalHome);
    } else {
      Deno.env.delete('HOME');
    }
  }
});
