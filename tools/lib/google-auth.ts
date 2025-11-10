/**
 * Google OAuth 2.0 認証モジュール
 *
 * Google Drive API へのアクセスに必要な OAuth 2.0 認証を提供する
 * デスクトップアプリケーション型の認証フローを実装
 */

import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import { OAuth2Client } from 'npm:google-auth-library@^9.0.0';

/**
 * 設定ディレクトリのパスを取得
 */
export function getConfigDir(): string {
  const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
  return join(home, '.config', 'photo-management');
}

/**
 * トークンファイルのパスを取得
 */
function getTokenPath(): string {
  return join(getConfigDir(), 'google-drive-token.json');
}

/**
 * 保存されたトークンを読み込む
 */
async function loadSavedToken(): Promise<object | null> {
  try {
    const tokenPath = getTokenPath();
    const content = await Deno.readTextFile(tokenPath);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * トークンをファイルに保存する
 */
async function saveToken(tokens: object): Promise<void> {
  const configDir = getConfigDir();
  await Deno.mkdir(configDir, { recursive: true });
  const tokenPath = getTokenPath();
  await Deno.writeTextFile(tokenPath, JSON.stringify(tokens, null, 2));
}

/**
 * ローカルサーバーを起動してOAuth認証コールバックを受信する
 *
 * @param _client OAuth2Client インスタンス (未使用)
 * @returns 認証コード
 */
async function getAuthCodeFromLocalServer(_client: OAuth2Client): Promise<string> {
  return new Promise((resolve, reject) => {
    let abortController: AbortController | null = null;

    console.log('🌐 ローカルサーバーを起動しました (http://localhost:8080)');

    const handler = (req: Request): Response => {
      const url = new URL(req.url);

      if (url.pathname === '/') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          const errorMessage = `認証エラー: ${error}`;
          if (abortController) abortController.abort();
          reject(new Error(errorMessage));
          return new Response(
            `<html lang="ja"><body><h1>認証失敗</h1><p>${errorMessage}</p></body></html>`,
            {
              status: 400,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        }

        if (code) {
          if (abortController) abortController.abort();
          resolve(code);
          return new Response(
            '<html lang="ja"><body><h1>認証成功！</h1><p>このウィンドウを閉じて、ターミナルに戻ってください。</p></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        }

        return new Response(
          '<html lang="ja"><body><h1>エラー</h1><p>認証コードが見つかりません</p></body></html>',
          {
            status: 400,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }
        );
      }

      return new Response('Not Found', { status: 404 });
    };

    abortController = new AbortController();
    Deno.serve(
      {
        port: 8080,
        signal: abortController.signal,
        onListen: () => {},
      },
      handler
    );
  });
}

/**
 * OAuth 2.0 認可フローを実行する
 *
 * @param client OAuth2Client インスタンス
 * @returns トークン情報
 */
async function performAuthFlow(client: OAuth2Client): Promise<object> {
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive'],
  });

  console.log();
  console.log('ブラウザが自動で開くので画面に従って認証してください:');
  console.log();
  console.log(`${authUrl}`);
  console.log();
  console.log('ブラウザが自動的に開かない場合は、上記URLに直接アクセスしてください。');
  console.log();

  const code = await getAuthCodeFromLocalServer(client);
  const { tokens } = await client.getToken(code);
  await saveToken(tokens);

  return tokens;
}

/**
 * OAuth2Client を取得する
 * 必要に応じて認証フローを実行する
 *
 * @param clientId OAuth 2.0 クライアントID
 * @param clientSecret OAuth 2.0 クライアントシークレット
 * @returns OAuth2Client インスタンス
 */
export async function getAuthClient(clientId: string, clientSecret: string): Promise<OAuth2Client> {
  const client = new OAuth2Client({
    clientId,
    clientSecret,
    redirectUri: 'http://localhost:8080',
  });

  // 保存されたトークンを読み込む
  const savedTokens = await loadSavedToken();

  if (savedTokens) {
    client.setCredentials(savedTokens);

    // トークンの有効性を確認
    try {
      const tokenInfo = await client.getAccessToken();
      if (tokenInfo.token) {
        return client;
      }
    } catch {
      // トークンが無効な場合は再認証
      console.log('⚠️ 保存されたトークンが無効です。再認証が必要です。');
    }
  }

  // 初回認証またはトークンが無効な場合
  console.log('Google Drive への認証を行います');
  const tokens = await performAuthFlow(client);
  client.setCredentials(tokens);

  return client;
}

/**
 * アクセストークンを取得する
 *
 * @param clientId OAuth 2.0 クライアントID
 * @param clientSecret OAuth 2.0 クライアントシークレット
 * @returns アクセストークン
 */
export async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const client = await getAuthClient(clientId, clientSecret);
  const tokenInfo = await client.getAccessToken();

  if (!tokenInfo.token) {
    throw new Error('アクセストークンの取得に失敗しました');
  }

  return tokenInfo.token;
}

/**
 * 現在認証されているアカウント情報を取得する
 *
 * @param client OAuth2Client インスタンス
 * @returns アカウントのメールアドレス（取得できない場合はnull）
 */
export async function getCurrentAccount(client: OAuth2Client): Promise<string | null> {
  try {
    const tokenInfo = await client.getTokenInfo((await client.getAccessToken()).token || '');
    return tokenInfo.email || null;
  } catch {
    return null;
  }
}
