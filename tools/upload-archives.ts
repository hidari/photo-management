#!/usr/bin/env deno run --allow-read --allow-write --allow-net --allow-env

/**
 * 撮影データGoogle Driveアップロードツール
 *
 * このスクリプトは、archive-distribution-dirs.tsで作成したzipファイルを
 * Google Driveにアップロードし、共有URLを取得してTOMLファイルに記録する
 *
 * 使い方:
 *   deno task upload                                    # 最新のイベントを自動検出
 *   deno task upload --event-dir ./path/to/event        # イベントディレクトリを指定
 *   deno task upload --config ./path/to/config.toml     # TOMLファイルを直接指定
 *   deno task upload --delete-after-upload              # アップロード後にzipを削除
 */

import { parse as parseFlags } from 'https://deno.land/std@0.208.0/flags/mod.ts';
import { basename, join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import {
  parse as parseToml,
  stringify as stringifyToml,
} from 'https://deno.land/std@0.208.0/toml/mod.ts';
import type { Config } from 'types/config.ts';
import config from '../config.ts';
import type { DirectoryConfig } from '../types/directory-config.ts';
import { findLatestEventDir, findTomlInEventDir } from './archive-distribution-dirs.ts';
import { buildDirectoryStructure, loadTomlConfig } from './generate-directories.ts';

/**
 * Google Drive OAuth2認証用の型（簡易版）
 */
interface GoogleAuthCredentials {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
}

interface GoogleAuthToken {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

/**
 * アーカイブファイルの情報
 */
export interface ArchiveInfo {
  /** モデル名 */
  modelName: string;
  /** zipファイルのパス */
  zipPath: string;
  /** イベント日付 */
  eventDate: string;
  /** イベント名 */
  eventName: string;
}

/**
 * 設定ディレクトリのパスを取得
 */
export function getConfigDir(): string {
  const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
  return join(home, '.config', 'photo-management');
}

/**
 * Google Drive認証情報を読み込む
 *
 * @returns 認証情報（見つからない場合はnull）
 */
export async function loadCredentials(): Promise<GoogleAuthCredentials | null> {
  try {
    const configDir = getConfigDir();
    const credentialsPath = join(configDir, 'credentials.json');
    const content = await Deno.readTextFile(credentialsPath);
    const data = JSON.parse(content);

    // OAuth2クライアント情報の形式を処理
    if (data.installed) {
      return data.installed as GoogleAuthCredentials;
    }
    if (data.web) {
      return data.web as GoogleAuthCredentials;
    }

    return data as GoogleAuthCredentials;
  } catch {
    return null;
  }
}

/**
 * トークンを読み込む
 *
 * @returns トークン（見つからない場合はnull）
 */
export async function loadToken(): Promise<GoogleAuthToken | null> {
  try {
    const configDir = getConfigDir();
    const tokenPath = join(configDir, 'token.json');
    const content = await Deno.readTextFile(tokenPath);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * トークンを保存する
 *
 * @param token - 保存するトークン
 */
export async function saveToken(token: GoogleAuthToken): Promise<void> {
  const configDir = getConfigDir();
  await Deno.mkdir(configDir, { recursive: true });
  const tokenPath = join(configDir, 'token.json');
  await Deno.writeTextFile(tokenPath, JSON.stringify(token, null, 2));
}

/**
 * PhotoDistributionフォルダのIDを読み込む
 *
 * @returns フォルダID（見つからない場合はnull）
 */
export async function loadFolderId(): Promise<string | null> {
  try {
    const configDir = getConfigDir();
    const folderIdPath = join(configDir, 'folder-id.txt');
    return (await Deno.readTextFile(folderIdPath)).trim();
  } catch {
    return null;
  }
}

/**
 * PhotoDistributionフォルダのIDを保存する
 *
 * @param folderId - 保存するフォルダID
 */
export async function saveFolderId(folderId: string): Promise<void> {
  const configDir = getConfigDir();
  await Deno.mkdir(configDir, { recursive: true });
  const folderIdPath = join(configDir, 'folder-id.txt');
  await Deno.writeTextFile(folderIdPath, folderId);
}

/**
 * OAuth2認証URLを生成する
 *
 * @param credentials - OAuth2クライアント認証情報
 * @returns 認証URL
 */
export function generateAuthUrl(credentials: GoogleAuthCredentials): string {
  const redirectUri = credentials.redirect_uris[0] || 'urn:ietf:wg:oauth:2.0:oob';
  const scope = 'https://www.googleapis.com/auth/drive.file';

  const params = new URLSearchParams({
    client_id: credentials.client_id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scope,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * 認証コードからトークンを取得する
 *
 * @param credentials - OAuth2クライアント認証情報
 * @param code - 認証コード
 * @returns アクセストークン
 */
export async function exchangeCodeForToken(
  credentials: GoogleAuthCredentials,
  code: string
): Promise<GoogleAuthToken> {
  const redirectUri = credentials.redirect_uris[0] || 'urn:ietf:wg:oauth:2.0:oob';

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code: code,
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`トークン取得に失敗しました: ${error}`);
  }

  return await response.json();
}

/**
 * リフレッシュトークンを使って新しいアクセストークンを取得する
 *
 * @param credentials - OAuth2クライアント認証情報
 * @param refreshToken - リフレッシュトークン
 * @returns 新しいアクセストークン
 */
export async function refreshAccessToken(
  credentials: GoogleAuthCredentials,
  refreshToken: string
): Promise<GoogleAuthToken> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`トークンのリフレッシュに失敗しました: ${error}`);
  }

  const newToken = await response.json();

  // リフレッシュトークンが返されない場合は元のものを保持
  if (!newToken.refresh_token) {
    newToken.refresh_token = refreshToken;
  }

  return newToken;
}

/**
 * トークンが有効かどうかを検証する
 *
 * @param accessToken - 検証するアクセストークン
 * @returns トークンが有効な場合true
 */
export async function validateToken(accessToken: string): Promise<boolean> {
  try {
    // Google Drive APIの軽量エンドポイントでトークンを検証
    const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 有効なアクセストークンを取得する
 *
 * @param credentials - OAuth2クライアント認証情報
 * @returns アクセストークン
 */
export async function getValidToken(credentials: GoogleAuthCredentials): Promise<string> {
  let token = await loadToken();

  // トークンが存在する場合は検証
  if (token) {
    const isValid = await validateToken(token.access_token);

    if (!isValid) {
      console.log('⚠️  保存されているトークンが無効です');

      // トークンが期限切れでリフレッシュトークンがある場合はリフレッシュを試行
      if (token.refresh_token) {
        console.log('🔄 トークンをリフレッシュしています...');
        try {
          token = await refreshAccessToken(credentials, token.refresh_token);
          await saveToken(token);
          console.log('✅ トークンのリフレッシュが完了しました');
          console.log();
          return token.access_token;
        } catch (error) {
          console.log(`❌ トークンのリフレッシュに失敗しました: ${error}`);
        }
      }

      // リフレッシュできない場合は再認証が必要
      console.log('🔐 再認証が必要です。既存のトークンを削除します...');
      const configDir = getConfigDir();
      const tokenPath = join(configDir, 'token.json');
      try {
        await Deno.remove(tokenPath);
      } catch {
        // ファイルが存在しない場合は無視
      }
      token = null; // 再認証フローに進む
    }
  }

  // トークンが存在しない場合は新規認証
  if (!token) {
    console.log('🔐 Google Drive認証が必要です');
    console.log();
    console.log('以下のURLをブラウザで開いてください:');
    console.log(generateAuthUrl(credentials));
    console.log();
    console.log('認証後に表示される認証コードを入力してください:');

    const buf = new Uint8Array(1024);
    const n = await Deno.stdin.read(buf);

    if (n === null) {
      throw new Error('認証コードの入力が中断されました');
    }

    const code = new TextDecoder().decode(buf.subarray(0, n)).trim();

    token = await exchangeCodeForToken(credentials, code);
    await saveToken(token);

    console.log('✅ 認証が完了しました');
    console.log();
  }

  // トークンが期限切れの場合はリフレッシュ
  if (token.expiry_date && Date.now() >= token.expiry_date) {
    if (!token.refresh_token) {
      throw new Error('リフレッシュトークンがありません。再認証が必要です。');
    }

    token = await refreshAccessToken(credentials, token.refresh_token);
    await saveToken(token);
  }

  return token.access_token;
}

/**
 * Google Drive APIでフォルダを検索する
 *
 * @param accessToken - アクセストークン
 * @param folderName - 検索するフォルダ名
 * @param parentId - 親フォルダID（指定しない場合はルート直下を検索）
 * @returns フォルダID（見つからない場合はnull）
 */
export async function findFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string | null> {
  const query = parentId
    ? `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`フォルダ検索に失敗しました: ${error}`);
  }

  const data = await response.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  return null;
}

/**
 * Google Drive APIでフォルダを作成する
 *
 * @param accessToken - アクセストークン
 * @param folderName - フォルダ名
 * @param parentId - 親フォルダID（指定しない場合はルート直下）
 * @returns 作成されたフォルダのID
 */
export async function createFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  const metadata: Record<string, unknown> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`フォルダ作成に失敗しました: ${error}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * PhotoDistributionフォルダを確保する（存在しない場合は作成）
 *
 * @param accessToken - アクセストークン
 * @returns フォルダID
 */
export async function ensurePhotoDistributionFolder(accessToken: string): Promise<string> {
  // 保存されているフォルダIDを確認
  let folderId = await loadFolderId();

  if (folderId) {
    // フォルダが実際に存在するか確認
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        return folderId;
      }
    } catch {
      // フォルダが見つからない場合は再作成
    }
  }

  // フォルダを検索
  folderId = await findFolder(accessToken, 'PhotoDistribution');

  if (!folderId) {
    // フォルダを作成
    console.log('📁 PhotoDistributionフォルダを作成中...');
    folderId = await createFolder(accessToken, 'PhotoDistribution');
    console.log(`   ✅ フォルダを作成しました (ID: ${folderId})`);
  }

  // フォルダIDを保存
  await saveFolderId(folderId);

  return folderId;
}

/**
 * イベント用フォルダを作成する（既存の場合は再利用）
 *
 * @param accessToken - アクセストークン
 * @param parentId - 親フォルダID
 * @param eventDate - イベント日付
 * @param eventName - イベント名
 * @returns フォルダID
 */
export async function createEventFolder(
  accessToken: string,
  parentId: string,
  eventDate: string,
  eventName: string
): Promise<string> {
  const folderName = `${eventDate}_${eventName}`;

  // 既存のフォルダを検索
  let folderId = await findFolder(accessToken, folderName, parentId);

  if (!folderId) {
    // フォルダを作成
    console.log(`📁 イベントフォルダを作成中: ${folderName}`);
    folderId = await createFolder(accessToken, folderName, parentId);
  }

  return folderId;
}

/**
 * ファイルをGoogle Driveにアップロードする
 *
 * @param accessToken - アクセストークン
 * @param filePath - アップロードするファイルのパス
 * @param folderId - アップロード先のフォルダID
 * @returns アップロードされたファイルのID
 */
export async function uploadFile(
  accessToken: string,
  filePath: string,
  folderId: string
): Promise<string> {
  const fileName = basename(filePath);
  const fileContent = await Deno.readFile(filePath);

  // メタデータを作成
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  // マルチパートアップロード（バイナリ直接送信）
  const boundary = '-------314159265358979323846';

  // マルチパートボディの各部分を構築
  const metadataPart = new TextEncoder().encode(
    `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      '\r\n'
  );

  const filePart = new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/zip\r\n\r\n`);

  const closingBoundary = new TextEncoder().encode(`\r\n--${boundary}--`);

  // すべてのパートを結合
  const totalLength =
    metadataPart.length + filePart.length + fileContent.length + closingBoundary.length;
  const body = new Uint8Array(totalLength);

  let offset = 0;
  body.set(metadataPart, offset);
  offset += metadataPart.length;
  body.set(filePart, offset);
  offset += filePart.length;
  body.set(fileContent, offset);
  offset += fileContent.length;
  body.set(closingBoundary, offset);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ファイルのアップロードに失敗しました: ${error}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * ファイルを公開して共有リンクを取得する
 *
 * @param accessToken - アクセストークン
 * @param fileId - ファイルID
 * @returns 共有リンク
 */
export async function makeFilePublic(accessToken: string, fileId: string): Promise<string> {
  // ファイルを公開設定にする
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ファイルの公開設定に失敗しました: ${error}`);
  }

  // ダイレクトダウンロードリンクを返す
  // この形式ではリンクを開くと直接ダウンロードが開始される
  // プレビュー画面を経由せず、モデルさんが混乱しない
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * ディレクトリ構造からアーカイブファイルの情報を取得する
 *
 * @param directoryConfig - TOMLから読み込んだ設定
 * @param appConfig - アプリケーション設定
 * @returns アーカイブファイル情報の配列
 */
export async function findArchiveFiles(
  directoryConfig: DirectoryConfig,
  appConfig: Config
): Promise<ArchiveInfo[]> {
  const archives: ArchiveInfo[] = [];

  for (const event of directoryConfig.events) {
    const structure = buildDirectoryStructure(event, appConfig);

    for (const model of structure.models) {
      const distDirName = basename(model.distDir);
      const zipPath = join(model.distDir, '..', `${distDirName}.zip`);

      // zipファイルが存在するか確認
      try {
        const stat = await Deno.stat(zipPath);
        if (stat.isFile) {
          archives.push({
            modelName: model.modelName,
            zipPath: zipPath,
            eventDate: event.date,
            eventName: event.event_name,
          });
        }
      } catch {
        // ファイルが存在しない場合はスキップ
        console.warn(`⚠️  警告: ${basename(zipPath)} が見つかりません`);
      }
    }
  }

  return archives;
}

/**
 * TOMLファイルを更新して共有URLを記録する
 *
 * @param tomlPath - TOMLファイルのパス
 * @param urlMap - モデル名と共有URLのマップ
 */
export async function updateTomlWithUrls(
  tomlPath: string,
  urlMap: Map<string, string>
): Promise<void> {
  // TOMLファイルを読み込む
  const content = await Deno.readTextFile(tomlPath);
  const data = parseToml(content) as unknown as DirectoryConfig;

  // URLを更新
  for (const event of data.events) {
    for (const model of event.models) {
      const url = urlMap.get(model.name);
      if (url) {
        model.download_url = url;
      }
    }
  }

  // TOMLファイルに書き戻す
  const updatedContent = stringifyToml(data as unknown as Record<string, unknown>);
  await Deno.writeTextFile(tomlPath, updatedContent);
}

/**
 * アーカイブファイルを削除する
 *
 * @param archivePaths - 削除するファイルパスの配列
 */
export async function deleteLocalArchives(archivePaths: string[]): Promise<void> {
  for (const path of archivePaths) {
    try {
      await Deno.remove(path);
      console.log(`   🗑️  削除: ${basename(path)}`);
    } catch (error) {
      console.warn(`   ⚠️  削除失敗: ${basename(path)} - ${error}`);
    }
  }
}

/**
 * スクリプトエントリーポイント
 */
async function main() {
  const args = parseFlags(Deno.args, {
    string: ['config', 'event-dir'],
    boolean: ['delete-after-upload'],
  });

  console.log('📤 撮影データGoogle Driveアップロードツール');
  console.log();

  // 認証情報を読み込む
  console.log('🔍 認証情報を確認中...');
  const credentials = await loadCredentials();

  if (!credentials) {
    console.error('❌ エラー: 認証情報が見つかりません');
    console.error(`   ${getConfigDir()}/credentials.json を配置してください`);
    console.error('   詳細はREADME.mdを参照してください');
    Deno.exit(1);
  }

  console.log('   ✅ 認証情報を読み込みました');
  console.log();

  let tomlPath: string | null;

  // TOMLファイルのパスを決定
  if (args.config) {
    tomlPath = args.config;
    console.log(`📄 指定された設定ファイル: ${tomlPath}`);
  } else if (args['event-dir']) {
    const eventDir = args['event-dir'];
    tomlPath = await findTomlInEventDir(eventDir);

    if (!tomlPath) {
      console.error(`❌ エラー: ${eventDir} 内にTOMLファイルが見つかりません`);
      Deno.exit(1);
    }

    console.log(`📂 指定されたイベント: ${basename(eventDir)}`);
    console.log(`📄 設定ファイル: ${basename(tomlPath)}`);
  } else {
    console.log('🔍 最新のイベントを検出中...');
    const latestEventDir = await findLatestEventDir(config.developedDirectoryBase);

    if (!latestEventDir) {
      console.error(
        `❌ エラー: ${config.developedDirectoryBase} 内にイベントディレクトリが見つかりません`
      );
      Deno.exit(1);
    }

    tomlPath = await findTomlInEventDir(latestEventDir);

    if (!tomlPath) {
      console.error(`❌ エラー: ${latestEventDir} 内にTOMLファイルが見つかりません`);
      Deno.exit(1);
    }

    console.log(`   ✅ 最新のイベントを検出しました: ${basename(latestEventDir)}`);
    console.log(`   📄 設定ファイル: ${basename(tomlPath)}`);
  }

  console.log();

  try {
    // TOMLファイルを読み込む
    const directoryConfig = await loadTomlConfig(tomlPath);

    // アーカイブファイルを探索
    console.log('🔍 アーカイブファイルを探索中...');
    const archives = await findArchiveFiles(directoryConfig, config);

    if (archives.length === 0) {
      console.error('❌ エラー: アップロード対象のzipファイルが見つかりません');
      console.error('   先に deno task archive を実行してください');
      Deno.exit(1);
    }

    console.log(`   ✅ ${archives.length}個のファイルを検出しました`);
    console.log();

    // アーカイブファイル一覧を表示
    console.log('📋 以下のファイルをアップロードします:');
    for (const archive of archives) {
      console.log(`   • ${basename(archive.zipPath)}`);
    }
    console.log();

    // アクセストークンを取得
    const accessToken = await getValidToken(credentials);

    // PhotoDistributionフォルダを確保
    console.log('📁 Google Driveフォルダを確認中...');
    const rootFolderId = await ensurePhotoDistributionFolder(accessToken);
    console.log(`   ✅ PhotoDistributionフォルダ (ID: ${rootFolderId})`);
    console.log();

    // イベントごとにグループ化
    const eventGroups = new Map<string, ArchiveInfo[]>();
    for (const archive of archives) {
      const key = `${archive.eventDate}_${archive.eventName}`;
      if (!eventGroups.has(key)) {
        eventGroups.set(key, []);
      }
      eventGroups.get(key)?.push(archive);
    }

    const urlMap = new Map<string, string>();

    // イベントごとにアップロード
    for (const [eventKey, eventArchives] of eventGroups) {
      const firstArchive = eventArchives[0];
      const eventFolderId = await createEventFolder(
        accessToken,
        rootFolderId,
        firstArchive.eventDate,
        firstArchive.eventName
      );

      console.log(`📤 ${eventKey} のファイルをアップロード中...`);

      for (const archive of eventArchives) {
        console.log(`   • ${basename(archive.zipPath)}`);

        // ファイルをアップロード
        const fileId = await uploadFile(accessToken, archive.zipPath, eventFolderId);

        // 共有リンクを取得
        const shareUrl = await makeFilePublic(accessToken, fileId);

        // URLマップに追加
        urlMap.set(archive.modelName, shareUrl);

        console.log(`     ✅ 完了: ${shareUrl}`);
      }

      console.log();
    }

    // TOMLファイルを更新
    console.log('📝 設定ファイルを更新中...');
    await updateTomlWithUrls(tomlPath, urlMap);
    console.log('   ✅ 共有URLを記録しました');
    console.log();

    // アップロード後の削除処理
    if (args['delete-after-upload']) {
      console.log('🗑️  ローカルのzipファイルを削除中...');
      const archivePaths = archives.map((a) => a.zipPath);
      await deleteLocalArchives(archivePaths);
      console.log();
    }

    console.log('🎉 すべてのアップロードが完了しました!');
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error('❌ エラー: ファイルが見つかりません');
      console.error(`   ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`❌ エラー: ${error.message}`);
    } else {
      console.error('❌ エラー: 予期しない問題が発生しました');
      console.error(error);
    }

    Deno.exit(1);
  }
}

// このファイルが直接実行された場合のみ、main関数を実行する
if (import.meta.main) {
  main();
}
