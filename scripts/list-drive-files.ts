/**
 * Google Driveフォルダ内のファイル一覧を取得するスクリプト
 *
 * 使い方:
 *   deno run --allow-read --allow-write --allow-run --allow-env --allow-net scripts/list-drive-files.ts <FOLDER_ID>
 */

import { config } from '../config.ts';
import { getAccessToken } from '../tools/lib/google-auth.ts';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
}

interface DriveFilesResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

/**
 * 指定フォルダ直下のファイル・フォルダ一覧を取得する
 */
async function listFiles(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const query = `'${folderId}' in parents and trashed=false`;
    const fields = 'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime)';
    const params = new URLSearchParams({
      q: query,
      fields,
      orderBy: 'name',
      pageSize: '1000',
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API エラー (${response.status}): ${JSON.stringify(errorData)}`);
    }

    const data: DriveFilesResponse = await response.json();
    allFiles.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

/**
 * ファイルサイズを人間が読みやすい形式にフォーマットする
 */
function formatSize(bytes: string | undefined): string {
  if (!bytes) return '-';
  const num = Number.parseInt(bytes, 10);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// --- メイン処理 ---

const folderId = Deno.args[0];
if (!folderId) {
  console.error('使い方: deno run ... scripts/list-drive-files.ts <FOLDER_ID>');
  Deno.exit(1);
}

if (!config.googleDrive) {
  console.error('config.ts に googleDrive 設定がありません');
  Deno.exit(1);
}

console.log(`フォルダID: ${folderId}`);
console.log('認証中...');

const accessToken = await getAccessToken(
  config.googleDrive.clientId,
  config.googleDrive.clientSecret
);

console.log('ファイル一覧を取得中...\n');

const files = await listFiles(accessToken, folderId);

if (files.length === 0) {
  console.log('フォルダ内にファイルが見つかりませんでした。');
  Deno.exit(0);
}

// フォルダとファイルを分類
const folders = files.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
const regularFiles = files.filter((f) => f.mimeType !== 'application/vnd.google-apps.folder');

console.log(
  `合計: ${files.length} 件 (フォルダ: ${folders.length}, ファイル: ${regularFiles.length})\n`
);

if (folders.length > 0) {
  console.log('--- フォルダ ---');
  for (const folder of folders) {
    console.log(`  [DIR] ${folder.name}`);
    console.log(`        ID: ${folder.id}`);
  }
  console.log();
}

if (regularFiles.length > 0) {
  console.log('--- ファイル ---');
  for (const file of regularFiles) {
    const size = formatSize(file.size);
    const modified = file.modifiedTime ? new Date(file.modifiedTime).toLocaleString('ja-JP') : '-';
    console.log(`  ${file.name}`);
    console.log(`        サイズ: ${size}  更新日: ${modified}  種類: ${file.mimeType}`);
    console.log(`        ID: ${file.id}`);
  }
}
