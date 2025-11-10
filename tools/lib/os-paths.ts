/**
 * OS固有のパス取得ユーティリティ
 *
 * 各OSのデフォルトディレクトリやホームディレクトリを取得する関数を提供します。
 */

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
