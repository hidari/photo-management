/**
 * Google Driveフォルダの検索・作成・検証を行うヘルパー関数
 */

import { basename } from 'https://deno.land/std@0.208.0/path/mod.ts';

/**
 * Google Drive APIでフォルダIDの存在を確認する
 *
 * @param accessToken - アクセストークン
 * @param folderId - 確認するフォルダID
 * @returns フォルダが存在し、かつフォルダタイプの場合true
 */
export async function verifyFolderId(accessToken: string, folderId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log(`  [DEBUG] API Status: ${response.status}`);

    if (response.status === 404) {
      console.log(`  [DEBUG] フォルダが見つかりません (404)`);
      console.log('  ℹ️  設定されたIDでフォルダが見つかりませんでした（自動的に再検索します）');
      return false;
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`  [DEBUG] API エラー: ${JSON.stringify(errorData)}`);
      return false;
    }

    const data = await response.json();
    console.log(`  [DEBUG] フォルダ情報: ${JSON.stringify(data)}`);

    const isFolder = data.mimeType === 'application/vnd.google-apps.folder';
    console.log(`  [DEBUG] フォルダタイプ: ${isFolder ? 'OK' : 'NG'}`);

    return isFolder;
  } catch (error) {
    console.error(
      `  [DEBUG] 検証エラー: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * Google Drive上で指定名のフォルダを検索する
 *
 * @param accessToken - アクセストークン
 * @param folderName - 検索するフォルダ名
 * @returns 見つかった場合フォルダID、見つからない場合null
 */
export async function findFolderByName(
  accessToken: string,
  folderName: string
): Promise<string | null> {
  try {
    const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=10`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Google Drive API エラー: ${JSON.stringify(errorData)}`);
      return null;
    }

    const data = await response.json();

    if (data.files && data.files.length > 0) {
      const folder = data.files[0];
      console.log(`  🔍 既存フォルダを検出: ${folder.name} (${folder.id})`);
      return folder.id;
    }

    return null;
  } catch (error) {
    console.error(`フォルダ検索に失敗: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Google Drive上に新しいフォルダを作成する
 *
 * @param accessToken - アクセストークン
 * @param folderName - 作成するフォルダ名
 * @returns 作成されたフォルダID
 */
export async function createFolder(accessToken: string, folderName: string): Promise<string> {
  try {
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google Drive API エラー: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log(`  ✨ 新しいフォルダを作成: ${folderName} (${data.id})`);
    console.log(`     URL: https://drive.google.com/drive/folders/${data.id}`);
    return data.id;
  } catch (error) {
    throw new Error(
      `フォルダ作成に失敗: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * photoDistributionFolderIdを検証・検索・作成する
 *
 * @param accessToken - アクセストークン
 * @param currentFolderId - 現在config.tsに設定されているフォルダID（未設定の場合はundefined）
 * @param defaultFolderName - デフォルトのフォルダ名（デフォルト: 'PhotoDistribution'）
 * @returns 有効なフォルダID
 */
export async function ensurePhotoDistributionFolder(
  accessToken: string,
  currentFolderId: string | undefined,
  defaultFolderName = 'PhotoDistribution'
): Promise<string> {
  console.log('📁 PhotoDistributionフォルダを確認しています...');

  // ケース1: フォルダIDが設定されている場合、存在を確認
  if (currentFolderId) {
    console.log(`  🔍 設定されたID (${currentFolderId}) を検証中...`);
    const isValid = await verifyFolderId(accessToken, currentFolderId);

    if (isValid) {
      console.log(`  ✅ フォルダが見つかりました。そのまま使用します`);
      return currentFolderId;
    }

    console.log(`  ⚠️  設定されたIDが無効です。再作成します`);
  }

  // ケース2: フォルダIDが未設定、または無効だった場合
  console.log(`  🔍 「${defaultFolderName}」フォルダを検索中...`);
  const foundFolderId = await findFolderByName(accessToken, defaultFolderName);

  if (foundFolderId) {
    return foundFolderId;
  }

  // ケース3: フォルダが見つからない場合、新規作成
  console.log(`  📁 「${defaultFolderName}」フォルダが見つかりませんでした`);
  const newFolderId = await createFolder(accessToken, defaultFolderName);
  return newFolderId;
}

/**
 * Google Drive APIでフォルダを検索する（親ID指定版）
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

  console.log(`  [DEBUG] フォルダ検索: ${folderName}`);
  console.log(`  [DEBUG] 親フォルダID: ${parentId || 'ルート直下'}`);
  console.log(`  [DEBUG] クエリ: ${query}`);

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  console.log(`  [DEBUG] API Status: ${response.status}`);

  if (!response.ok) {
    const error = await response.text();
    console.log(`  [DEBUG] API エラー: ${error}`);
    throw new Error(`フォルダ検索に失敗しました: ${error}`);
  }

  const data = await response.json();
  console.log(`  [DEBUG] 検索結果: ${data.files?.length || 0}件`);

  if (data.files && data.files.length > 0) {
    console.log(`  [DEBUG] 既存フォルダ検出: ${data.files[0].name} (${data.files[0].id})`);
    return data.files[0].id;
  }

  console.log(`  [DEBUG] フォルダが見つかりませんでした`);
  return null;
}

/**
 * Google Drive APIでフォルダを作成する（親ID指定版）
 *
 * @param accessToken - アクセストークン
 * @param folderName - フォルダ名
 * @param parentId - 親フォルダID（指定しない場合はルート直下）
 * @returns 作成されたフォルダのID
 */
export async function createFolderWithParent(
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

  console.log(`\n📁 イベントフォルダを確認中: ${folderName}`);
  console.log(`  [DEBUG] 親フォルダID: ${parentId}`);

  // 既存のフォルダを検索
  let folderId = await findFolder(accessToken, folderName, parentId);

  if (!folderId) {
    // フォルダを作成
    console.log(`📁 イベントフォルダを作成中: ${folderName}`);
    folderId = await createFolderWithParent(accessToken, folderName, parentId);
    console.log(`✅ イベントフォルダ作成完了: ${folderId}`);
  } else {
    console.log(`✅ 既存のイベントフォルダを使用: ${folderId}`);
  }

  return folderId;
}

/**
 * モデル用フォルダを作成する
 *
 * @param accessToken - アクセストークン
 * @param parentId - 親フォルダID（イベントフォルダ）
 * @param modelName - モデル名
 * @returns フォルダID
 */
export async function createModelFolder(
  accessToken: string,
  parentId: string,
  modelName: string
): Promise<string> {
  const folderName = `${modelName}用フォルダ`;

  // 既存のフォルダを検索
  let folderId = await findFolder(accessToken, folderName, parentId);

  if (!folderId) {
    // フォルダを作成
    folderId = await createFolderWithParent(accessToken, folderName, parentId);
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

  const filePart = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`
  );

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
 * フォルダを共有して共有リンクを取得する
 * allowFileDiscovery: false により、検索結果に表示されない
 *
 * @param accessToken - アクセストークン
 * @param folderId - フォルダID
 * @returns 共有リンク
 */
export async function makeFolderPublic(accessToken: string, folderId: string): Promise<string> {
  // フォルダを公開設定にする
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
        allowFileDiscovery: false,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`フォルダの公開設定に失敗しました: ${error}`);
  }

  // フォルダのウェブリンクを返す
  return `https://drive.google.com/drive/folders/${folderId}`;
}
