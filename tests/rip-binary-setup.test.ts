import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  buildDownloadUrl,
  detectPlatform,
  getBinaryPath,
  testBinary,
} from '../tools/lib/rip-binary-setup.ts';

/**
 * detectPlatformのテスト
 */
Deno.test('detectPlatform: プラットフォーム情報を返す', () => {
  const platform = detectPlatform();

  assertExists(platform.os);
  assertExists(platform.arch);
  assertExists(platform.zipName);
  assertExists(platform.binaryName);

  // zipNameは適切な形式か確認
  assertEquals(platform.zipName.startsWith('rip-zip-'), true);
  assertEquals(platform.zipName.endsWith('.zip'), true);

  // binaryNameはripまたはrip.exeか確認
  assertEquals(['rip', 'rip.exe'].includes(platform.binaryName), true);
});

/**
 * getBinaryPathのテスト
 */
Deno.test('getBinaryPath: バイナリパスを返す', () => {
  const binaryPath = getBinaryPath();

  assertExists(binaryPath);
  // クロスプラットフォーム対応: Unix形式(/)とWindows形式(\)の両方をチェック
  const hasConfigPath =
    binaryPath.includes('.config/photo-management/bin') ||
    binaryPath.includes('.config\\photo-management\\bin');
  assertEquals(hasConfigPath, true);
  assertEquals(binaryPath.includes('rip'), true);
});

/**
 * buildDownloadUrlのテスト
 */
Deno.test('buildDownloadUrl: ダウンロードURLを構築する', () => {
  const mockRelease = {
    tag_name: 'v1.0.0',
    assets: [
      {
        name: 'rip-zip-aarch64-apple-darwin.zip',
        browser_download_url:
          'https://github.com/hidari/rip-zip/releases/download/v1.0.0/rip-zip-aarch64-apple-darwin.zip',
      },
      {
        name: 'rip-zip-x86_64-unknown-linux-gnu.zip',
        browser_download_url:
          'https://github.com/hidari/rip-zip/releases/download/v1.0.0/rip-zip-x86_64-unknown-linux-gnu.zip',
      },
    ],
  };

  const url = buildDownloadUrl(mockRelease, 'rip-zip-aarch64-apple-darwin.zip');

  assertEquals(
    url,
    'https://github.com/hidari/rip-zip/releases/download/v1.0.0/rip-zip-aarch64-apple-darwin.zip'
  );
});

/**
 * buildDownloadUrlのテスト: アセットが見つからない場合
 */
Deno.test('buildDownloadUrl: アセットが見つからない場合エラーを投げる', () => {
  const mockRelease = {
    tag_name: 'v1.0.0',
    assets: [
      {
        name: 'rip-zip-aarch64-apple-darwin.zip',
        browser_download_url:
          'https://github.com/hidari/rip-zip/releases/download/v1.0.0/rip-zip-aarch64-apple-darwin.zip',
      },
    ],
  };

  try {
    buildDownloadUrl(mockRelease, 'non-existent.zip');
    assertEquals(true, false, 'エラーが発生するはずだった');
  } catch (error) {
    assertEquals(error instanceof Error, true);
    assertEquals((error as Error).message.includes('指定されたアセットが見つかりません'), true);
  }
});

/**
 * testBinaryのテスト: 無効なパス
 */
Deno.test('testBinary: 無効なパスでfalseを返す', async () => {
  const result = await testBinary('/non/existent/path/to/binary');
  assertEquals(result, false);
});

/**
 * testBinaryのテスト: 実行可能なコマンド
 */
Deno.test('testBinary: 実行可能なコマンドでtrueを返す', async () => {
  // denoコマンド自体をテスト（確実に存在する）
  const result = await testBinary('deno');
  assertEquals(result, true);
});
