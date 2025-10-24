/**
 * SNS関連のユーティリティ関数
 */

/**
 * SNSフィールドからXのユーザー名を抽出・正規化する
 *
 * @param snsField - SNSフィールドの値（URL, @username, username）
 * @returns 正規化されたユーザー名（@なし）
 */
export function cleanUsername(snsField: string): string {
  // URLの場合
  if (snsField.includes('twitter.com/') || snsField.includes('x.com/')) {
    const match = snsField.match(/(?:twitter\.com|x\.com)\/([^/?#]+)/);
    return match ? match[1] : snsField;
  }

  // @usernameの場合
  return snsField.replace('@', '');
}

/**
 * SNS入力を正規化してXのURLに変換する
 *
 * @param input - ユーザー入力（URL、@username、username）
 * @returns 正規化されたX（Twitter）のURL、または undefined
 */
export function normalizeSnsUrl(input: string): string | undefined {
  const trimmed = input.trim();

  if (!trimmed) {
    return undefined;
  }

  // 既にURL形式の場合はバリデーション
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      new URL(trimmed);
      return trimmed;
    } catch {
      return undefined;
    }
  }

  // @が途中や複数ある場合は無効とする（先頭の1つだけ許可）
  const atCount = (trimmed.match(/@/g) || []).length;
  if (atCount > 1) {
    return undefined;
  }

  // @が途中にある場合（先頭以外）は無効
  const atIndex = trimmed.indexOf('@');
  if (atIndex > 0) {
    return undefined;
  }

  // ユーザー名を抽出してURLに変換
  const username = cleanUsername(trimmed);

  // ユーザー名の基本的な検証（英数字、アンダースコアのみ）
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return undefined;
  }

  return `https://x.com/${username}`;
}
