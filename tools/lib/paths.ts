/**
 * パス関連ユーティリティ
 *
 * OS固有のパスやアプリケーション設定ファイルのパスを一元管理します。
 */

import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';

/**
 * ホームディレクトリのパスを取得
 *
 * @returns ホームディレクトリのパス、取得できない場合はundefined
 */
export function getHomeDirectory(): string | undefined {
  const os = Deno.build.os;

  if (os === 'windows') {
    return Deno.env.get('USERPROFILE');
  }
  // macOS/Linux
  return Deno.env.get('HOME');
}

/**
 * OS別のデフォルト写真ディレクトリを取得
 *
 * @returns デフォルト写真ディレクトリのパス
 */
export function getDefaultPicturesDirectory(): string {
  const os = Deno.build.os;
  const home = getHomeDirectory();

  if (os === 'windows') {
    // Windows: %USERPROFILE%\Pictures
    if (home) {
      return `${home}\\Pictures`;
    }
    // フォールバック
    return 'C:\\Users\\your_name\\Pictures';
  }
  // macOS/Linux: ~/Pictures
  if (home) {
    return `${home}/Pictures`;
  }
  // フォールバック
  return '/Users/your_name/Pictures';
}

/**
 * 設定ディレクトリのパスを取得
 *
 * @returns 設定ディレクトリのパス (~/.config/photo-management)
 */
export function getConfigDir(): string {
  const home = getHomeDirectory() || '';
  return join(home, '.config', 'photo-management');
}

/**
 * トークンファイルのパスを取得
 *
 * @returns トークンファイルのパス
 */
export function getTokenPath(): string {
  return join(getConfigDir(), 'google-drive-token.json');
}
