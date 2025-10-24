import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { cleanUsername, normalizeSnsUrl } from '../tools/lib/sns-utils.ts';

/**
 * cleanUsernameのテスト
 */
Deno.test('cleanUsername: Twitter URLからユーザー名を抽出する', () => {
  assertEquals(cleanUsername('https://twitter.com/example'), 'example');
  assertEquals(cleanUsername('https://twitter.com/example_user'), 'example_user');
  assertEquals(cleanUsername('https://twitter.com/user123'), 'user123');
  assertEquals(cleanUsername('http://twitter.com/example'), 'example'); // httpでも抽出可能
});

Deno.test('cleanUsername: X.com URLからユーザー名を抽出する', () => {
  assertEquals(cleanUsername('https://x.com/example'), 'example');
  assertEquals(cleanUsername('https://x.com/example_user'), 'example_user');
  assertEquals(cleanUsername('https://x.com/user123'), 'user123');
  assertEquals(cleanUsername('http://x.com/example'), 'example'); // httpでも抽出可能
});

Deno.test('cleanUsername: クエリパラメータやハッシュを除外する', () => {
  assertEquals(cleanUsername('https://twitter.com/example?lang=en'), 'example');
  assertEquals(cleanUsername('https://x.com/example#tweets'), 'example');
  assertEquals(cleanUsername('https://twitter.com/example/status/123'), 'example');
});

Deno.test('cleanUsername: @付きユーザー名から@を削除する', () => {
  assertEquals(cleanUsername('@example'), 'example');
  assertEquals(cleanUsername('@user_name'), 'user_name');
  assertEquals(cleanUsername('@123user'), '123user');
});

Deno.test('cleanUsername: ユーザー名のみの場合はそのまま返す', () => {
  assertEquals(cleanUsername('example'), 'example');
  assertEquals(cleanUsername('user_name'), 'user_name');
  assertEquals(cleanUsername('user123'), 'user123');
});

/**
 * normalizeSnsUrlのテスト
 */
Deno.test('normalizeSnsUrl: 完全なTwitter URLを受け入れる', () => {
  assertEquals(normalizeSnsUrl('https://twitter.com/example'), 'https://twitter.com/example');
  assertEquals(normalizeSnsUrl('https://x.com/example'), 'https://x.com/example');
  assertEquals(
    normalizeSnsUrl('https://twitter.com/example?lang=en'),
    'https://twitter.com/example?lang=en'
  );
});

Deno.test('normalizeSnsUrl: 完全なURL（Twitter以外）を受け入れる', () => {
  assertEquals(normalizeSnsUrl('https://instagram.com/example'), 'https://instagram.com/example');
  assertEquals(normalizeSnsUrl('https://github.com/example'), 'https://github.com/example');
});

Deno.test('normalizeSnsUrl: @付きユーザー名をX URLに変換する', () => {
  assertEquals(normalizeSnsUrl('@example'), 'https://x.com/example');
  assertEquals(normalizeSnsUrl('@user_name'), 'https://x.com/user_name');
  assertEquals(normalizeSnsUrl('@user123'), 'https://x.com/user123');
});

Deno.test('normalizeSnsUrl: ユーザー名のみをX URLに変換する', () => {
  assertEquals(normalizeSnsUrl('example'), 'https://x.com/example');
  assertEquals(normalizeSnsUrl('user_name'), 'https://x.com/user_name');
  assertEquals(normalizeSnsUrl('user123'), 'https://x.com/user123');
});

Deno.test('normalizeSnsUrl: 空文字列でundefinedを返す', () => {
  assertEquals(normalizeSnsUrl(''), undefined);
  assertEquals(normalizeSnsUrl('   '), undefined);
  assertEquals(normalizeSnsUrl('\t'), undefined);
});

Deno.test('normalizeSnsUrl: 無効なユーザー名を拒否する', () => {
  assertEquals(normalizeSnsUrl('user name'), undefined); // スペース含む
  assertEquals(normalizeSnsUrl('user-name'), undefined); // ハイフン含む
  assertEquals(normalizeSnsUrl('user.name'), undefined); // ドット含む
  assertEquals(normalizeSnsUrl('ユーザー名'), undefined); // 日本語
  assertEquals(normalizeSnsUrl('user@name'), undefined); // @が途中にある
  assertEquals(normalizeSnsUrl('@user@name'), undefined); // @が複数ある
});

Deno.test('normalizeSnsUrl: 無効なURLを拒否する', () => {
  assertEquals(normalizeSnsUrl('http://'), undefined);
  assertEquals(normalizeSnsUrl('https://'), undefined);
  assertEquals(normalizeSnsUrl('not a url'), undefined);
});

Deno.test('normalizeSnsUrl: 先頭と末尾の空白を削除する', () => {
  assertEquals(normalizeSnsUrl('  example  '), 'https://x.com/example');
  assertEquals(normalizeSnsUrl(' @example '), 'https://x.com/example');
  assertEquals(normalizeSnsUrl('  https://x.com/example  '), 'https://x.com/example');
});

Deno.test('normalizeSnsUrl: Twitter URLもX URLに変換せずそのまま返す', () => {
  // Twitter URLはそのまま保持（正規化しない）
  assertEquals(normalizeSnsUrl('https://twitter.com/example'), 'https://twitter.com/example');
});

Deno.test('normalizeSnsUrl: http://をhttps://に変換する', () => {
  // httpで入力されたURLは必ずhttpsに変換される
  assertEquals(normalizeSnsUrl('http://twitter.com/example'), 'https://twitter.com/example');
  assertEquals(normalizeSnsUrl('http://x.com/example'), 'https://x.com/example');
  assertEquals(normalizeSnsUrl('http://instagram.com/example'), 'https://instagram.com/example');
  assertEquals(normalizeSnsUrl('http://github.com/example'), 'https://github.com/example');
});

/**
 * cleanUsernameとnormalizeSnsUrlの統合テスト
 */
Deno.test('統合: 様々な入力形式からユーザー名を抽出してURLに変換', () => {
  const inputs = ['https://twitter.com/example', 'https://x.com/example', '@example', 'example'];

  // すべて有効なURLに変換されることを確認
  for (const input of inputs) {
    const result = normalizeSnsUrl(input);
    assertEquals(result !== undefined, true, `${input} should be normalized`);
    assertEquals(result?.includes('example'), true, `${input} should contain 'example' in result`);
  }
});
