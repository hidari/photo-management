/**
 * Google Drive上の古いイベントフォルダ削除ロジック
 *
 * CLIとGoogle Apps Scriptの両方から使用される共通ロジック
 */

/**
 * イベントフォルダの情報
 */
export interface EventFolderInfo {
  /** フォルダID */
  id: string;

  /** フォルダ名 */
  name: string;

  /** 作成日時 */
  createdTime: Date;

  /** フォルダが作成されてからの経過日数 */
  daysOld: number;
}

/**
 * 削除結果の情報
 */
export interface CleanupResult {
  /** 削除されたフォルダの数 */
  deletedCount: number;

  /** 削除されたフォルダの情報 */
  deletedFolders: EventFolderInfo[];

  /** エラーが発生したフォルダの情報 */
  errors: Array<{ folder: EventFolderInfo; error: string }>;
}

/**
 * PhotoDistributionフォルダ内のイベントフォルダを一覧取得する
 *
 * @param accessToken - アクセストークン
 * @param parentFolderId - PhotoDistributionフォルダのID
 * @returns イベントフォルダの情報配列
 */
export async function listEventFolders(
  accessToken: string,
  parentFolderId: string
): Promise<EventFolderInfo[]> {
  const query = `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime)&orderBy=createdTime`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`フォルダ一覧の取得に失敗しました: ${error}`);
  }

  const data = await response.json();
  const now = new Date();

  const folders: EventFolderInfo[] = [];
  for (const file of data.files || []) {
    const createdTime = new Date(file.createdTime);
    const daysOld = Math.floor((now.getTime() - createdTime.getTime()) / (1000 * 60 * 60 * 24));

    folders.push({
      id: file.id,
      name: file.name,
      createdTime,
      daysOld,
    });
  }

  return folders;
}

/**
 * 指定した日数より古いイベントフォルダを抽出する
 *
 * @param folders - イベントフォルダの情報配列
 * @param retentionDays - 保持期間(日数)
 * @returns 削除対象のフォルダ配列
 */
export function filterOldFolders(
  folders: EventFolderInfo[],
  retentionDays: number
): EventFolderInfo[] {
  return folders.filter((folder) => folder.daysOld > retentionDays);
}

/**
 * フォルダを削除する
 *
 * @param accessToken - アクセストークン
 * @param folderId - 削除するフォルダID
 */
export async function deleteFolder(accessToken: string, folderId: string): Promise<void> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`フォルダの削除に失敗しました: ${error}`);
  }
}

/**
 * 複数のフォルダを削除する
 *
 * @param accessToken - アクセストークン
 * @param folders - 削除するフォルダの情報配列
 * @returns 削除結果
 */
export async function deleteFolders(
  accessToken: string,
  folders: EventFolderInfo[]
): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedCount: 0,
    deletedFolders: [],
    errors: [],
  };

  for (const folder of folders) {
    try {
      await deleteFolder(accessToken, folder.id);
      result.deletedCount++;
      result.deletedFolders.push(folder);
    } catch (error) {
      result.errors.push({
        folder,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * 古いイベントフォルダをクリーンアップする（メイン処理）
 *
 * @param accessToken - アクセストークン
 * @param parentFolderId - PhotoDistributionフォルダのID
 * @param retentionDays - 保持期間(日数)
 * @param dryRun - dry-runモード（trueの場合は削除を実行しない）
 * @returns 削除対象のフォルダ配列（dry-runモード）または削除結果
 */
export async function cleanupOldEvents(
  accessToken: string,
  parentFolderId: string,
  retentionDays: number,
  dryRun: boolean
): Promise<EventFolderInfo[] | CleanupResult> {
  // イベントフォルダを一覧取得
  const allFolders = await listEventFolders(accessToken, parentFolderId);

  // 古いフォルダを抽出
  const oldFolders = filterOldFolders(allFolders, retentionDays);

  // dry-runモードの場合は削除対象を返すだけ
  if (dryRun) {
    return oldFolders;
  }

  // 実際に削除を実行
  return await deleteFolders(accessToken, oldFolders);
}
