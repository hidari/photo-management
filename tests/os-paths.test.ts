import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getDefaultPicturesDirectory, getHomeDirectory } from '../tools/lib/os-paths.ts';

Deno.test('getHomeDirectory: ホームディレクトリを取得する', () => {
  const home = getHomeDirectory();

  // 実際の環境変数が設定されている場合は文字列が返る
  if (home !== undefined) {
    assertEquals(typeof home, 'string');
    // 空文字列ではないことを確認
    assertEquals(home.length > 0, true);
  }
});

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
