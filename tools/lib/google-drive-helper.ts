/**
 * Google Driveフォルダの検索・作成・検証を行うヘルパー関数
 */

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
      console.log('');
      console.log('  ⚠️  フォルダID検証エラー: このフォルダにアクセスできません');
      console.log('');
      console.log('  考えられる原因:');
      console.log('  1. 古いアクセストークンを使用している（最も可能性が高い）');
      console.log('     → 解決: 以下のコマンドでトークンを削除してから再実行');
      console.log('       rm ~/.config/photo-management/google-drive-token.json');
      console.log('       deno task gas:setup');
      console.log('');
      console.log('  2. フォルダが削除されている');
      console.log('     → 解決: 新しいフォルダが自動作成されます');
      console.log('');
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
