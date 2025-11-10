import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';

/**
 * テスト用の認証関連ヘルパー関数
 *
 * このファイルは、upload-archives.tsの認証機能をテストするための
 * ヘルパー関数を提供します。本番の設定ディレクトリを汚さないよう、
 * テスト専用の一時ディレクトリを使用します。
 */

/**
 * Google Drive OAuth2トークンの型
 */
export interface GoogleAuthToken {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

/**
 * テスト用の設定ディレクトリのパスを取得
 *
 * @returns テスト用設定ディレクトリのパス
 */
export function getTestConfigDir(): string {
  return './tests/tmp-upload-config';
}

/**
 * テスト用のトークンを保存する
 *
 * @param token - 保存するトークン
 */
export async function saveTestToken(token: GoogleAuthToken): Promise<void> {
  const configDir = getTestConfigDir();
  await Deno.mkdir(configDir, { recursive: true });
  const tokenPath = join(configDir, 'google-drive-token.json');
  await Deno.writeTextFile(tokenPath, JSON.stringify(token, null, 2));
}

/**
 * テスト用のトークンを読み込む
 *
 * @returns トークン（見つからない場合はnull）
 */
export async function loadTestToken(): Promise<GoogleAuthToken | null> {
  try {
    const configDir = getTestConfigDir();
    const tokenPath = join(configDir, 'google-drive-token.json');
    const content = await Deno.readTextFile(tokenPath);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * テスト用の認証情報を保存する
 *
 * @param credentials - 保存する認証情報
 */
export async function saveTestCredentials(credentials: unknown): Promise<void> {
  const configDir = getTestConfigDir();
  await Deno.mkdir(configDir, { recursive: true });
  const credentialsPath = join(configDir, 'credentials.json');
  await Deno.writeTextFile(credentialsPath, JSON.stringify(credentials, null, 2));
}

/**
 * テスト用設定ディレクトリをクリーンアップする
 */
export async function cleanupTestConfig(): Promise<void> {
  try {
    const configDir = getTestConfigDir();
    await Deno.remove(configDir, { recursive: true });
  } catch {
    // ディレクトリが存在しない場合は無視
  }
}
