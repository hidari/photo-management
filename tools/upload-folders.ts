#!/usr/bin/env deno run --allow-read --allow-write --allow-net --allow-env

/**
 * 撮影データGoogle Driveフォルダ共有アップロードツール
 *
 * このスクリプトは、個別の写真ファイルをモデルごとのフォルダにアップロードし、
 * フォルダ共有リンクを取得してTOMLファイルに記録する
 *
 * 使い方:
 *   deno task upload-folders                             # 最新のイベントを自動検出
 *   deno task upload-folders --event-dir ./path/to/event # イベントディレクトリを指定
 *   deno task upload-folders --config ./path/to/config.toml # TOMLファイルを直接指定
 */

import { parse as parseFlags } from 'https://deno.land/std@0.208.0/flags/mod.ts';
import { basename, join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import {
  parse as parseToml,
  stringify as stringifyToml,
} from 'https://deno.land/std@0.208.0/toml/mod.ts';
import type { Config } from 'types/config.ts';
import config from '../config.ts';
import type { DistributionConfig } from '../types/distribution-config.ts';
import { loadTomlConfig } from './lib/config-loader.ts';
import { findLatestEventDir, findTomlInEventDir } from './lib/directory-finder.ts';
import { buildDirectoryStructure } from './lib/directory-structure.ts';
import { getAccessToken, getAuthClient, getCurrentAccount } from './lib/google-auth.ts';

/**
 * 設定ディレクトリのパスを取得
 */
export function getConfigDir(): string {
  const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
  return join(home, '.config', 'photo-management');
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

      // エラーレスポンスのbodyを消費
      await response.text();
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
 * 親フォルダは非公開のままにする
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

/**
 * フォルダを削除する（エラーハンドリング用）
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
    console.warn(`   ⚠️  フォルダの削除に失敗しました (ID: ${folderId}): ${error}`);
  }
}

/**
 * DIST_DIRから写真ファイルを取得する
 *
 * @param distDir - DIST_DIRのパス
 * @returns 写真ファイルのパス配列
 */
export async function listPhotoFiles(distDir: string): Promise<string[]> {
  const photos: string[] = [];

  for await (const entry of Deno.readDir(distDir)) {
    if (entry.isFile) {
      const ext = entry.name.toLowerCase().split('.').pop();
      // 写真ファイルの拡張子のみを対象にする（READMEなどは除外）
      if (ext && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
        photos.push(join(distDir, entry.name));
      }
    }
  }

  return photos.sort();
}

/**
 * モデルごとの写真情報
 */
interface ModelPhotos {
  modelName: string;
  distDir: string;
  photos: string[];
  eventDate: string;
  eventName: string;
}

/**
 * ディレクトリ構造から写真ファイルの情報を取得する
 *
 * @param directoryConfig - TOMLから読み込んだ設定
 * @param appConfig - アプリケーション設定
 * @returns モデルごとの写真情報配列
 */
export async function findPhotoFiles(
  directoryConfig: DistributionConfig,
  appConfig: Config
): Promise<ModelPhotos[]> {
  const modelPhotos: ModelPhotos[] = [];

  for (const event of directoryConfig.events) {
    const structure = buildDirectoryStructure(event, appConfig);

    for (const model of structure.models) {
      // DIST_DIRが存在するか確認
      try {
        const stat = await Deno.stat(model.distDir);
        if (stat.isDirectory) {
          const photos = await listPhotoFiles(model.distDir);

          if (photos.length > 0) {
            modelPhotos.push({
              modelName: model.modelName,
              distDir: model.distDir,
              photos: photos,
              eventDate: event.date,
              eventName: event.event_name,
            });
          } else {
            console.warn(`   ⚠️  警告: ${model.modelName} のフォルダに写真ファイルがありません`);
          }
        }
      } catch {
        // ディレクトリが存在しない場合はスキップ
        console.warn(`   ⚠️  警告: ${model.modelName} のDIST_DIRが見つかりません`);
      }
    }
  }

  return modelPhotos;
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
  const data = parseToml(content) as unknown as DistributionConfig;

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
 * スクリプトエントリーポイント
 */
async function main() {
  const args = parseFlags(Deno.args, {
    string: ['config', 'event-dir'],
  });

  console.log('📤 撮影データGoogle Driveフォルダ共有アップロードツール');
  console.log();

  // Google Drive設定の存在確認
  if (!config.googleDrive) {
    console.error('❌ エラー: Google Drive設定が見つかりません');
    console.error('   config.tsにgoogleDrive設定を追加してください');
    console.error('   例:');
    console.error('   googleDrive: {');
    console.error('     clientId: "your-client-id.apps.googleusercontent.com",');
    console.error('     clientSecret: "your-client-secret"');
    console.error('   }');
    Deno.exit(1);
  }

  // OAuth認証を実行
  console.log('🔐 Google Drive認証を確認中...');

  try {
    const client = await getAuthClient(
      config.googleDrive.clientId,
      config.googleDrive.clientSecret
    );
    const currentAccount = await getCurrentAccount(client);

    if (currentAccount) {
      console.log(`   👤 認証アカウント: ${currentAccount}`);
    }
    console.log('   ✅ 認証完了');
  } catch (error) {
    console.error('❌ エラー: Google Drive認証に失敗しました');
    console.error(`   詳細: ${error instanceof Error ? error.message : error}`);
    Deno.exit(1);
  }

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

  const createdFolderIds: string[] = [];

  try {
    // TOMLファイルを読み込む
    const directoryConfig = await loadTomlConfig(tomlPath);

    // 写真ファイルを探索
    console.log('🔍 写真ファイルを探索中...');
    const modelPhotos = await findPhotoFiles(directoryConfig, config);

    if (modelPhotos.length === 0) {
      console.error('❌ エラー: アップロード対象の写真ファイルが見つかりません');
      console.error('   先に deno task dirs を実行してください');
      Deno.exit(1);
    }

    let totalPhotos = 0;
    for (const mp of modelPhotos) {
      totalPhotos += mp.photos.length;
    }

    console.log(`   ✅ ${modelPhotos.length}モデル、合計${totalPhotos}ファイルを検出しました`);
    console.log();

    // アクセストークンを取得
    const accessToken = await getAccessToken(
      config.googleDrive.clientId,
      config.googleDrive.clientSecret
    );

    // PhotoDistributionフォルダを確保
    console.log('📁 Google Driveフォルダを確認中...');
    const rootFolderId = await ensurePhotoDistributionFolder(accessToken);
    console.log(`   ✅ PhotoDistributionフォルダ (ID: ${rootFolderId})`);
    console.log();

    // イベントごとにグループ化
    const eventGroups = new Map<string, ModelPhotos[]>();
    for (const mp of modelPhotos) {
      const key = `${mp.eventDate}_${mp.eventName}`;
      if (!eventGroups.has(key)) {
        eventGroups.set(key, []);
      }
      eventGroups.get(key)?.push(mp);
    }

    const urlMap = new Map<string, string>();

    // イベントごとにアップロード
    for (const [eventKey, eventPhotos] of eventGroups) {
      const firstPhoto = eventPhotos[0];
      const eventFolderId = await createEventFolder(
        accessToken,
        rootFolderId,
        firstPhoto.eventDate,
        firstPhoto.eventName
      );
      createdFolderIds.push(eventFolderId);

      console.log(`📤 ${eventKey} のファイルをアップロード中...`);

      for (const mp of eventPhotos) {
        console.log(`   • ${mp.modelName} (${mp.photos.length}ファイル)`);

        // モデル用フォルダを作成
        const modelFolderId = await createModelFolder(accessToken, eventFolderId, mp.modelName);
        createdFolderIds.push(modelFolderId);

        // 写真をアップロード
        for (const photoPath of mp.photos) {
          await uploadFile(accessToken, photoPath, modelFolderId);
        }

        // フォルダを共有設定にして共有リンクを取得
        const shareUrl = await makeFolderPublic(accessToken, modelFolderId);

        // URLマップに追加
        urlMap.set(mp.modelName, shareUrl);

        console.log(`     ✅ 完了: ${shareUrl}`);
      }

      console.log();
    }

    // TOMLファイルを更新
    console.log('📝 設定ファイルを更新中...');
    await updateTomlWithUrls(tomlPath, urlMap);
    console.log('   ✅ 共有URLを記録しました');
    console.log();

    console.log('🎉 すべてのアップロードが完了しました!');
  } catch (error) {
    // エラー発生時は作成途中のフォルダを削除
    if (createdFolderIds.length > 0) {
      console.error();
      console.error('🗑️  エラーが発生したため、作成途中のフォルダを削除中...');

      try {
        if (!config.googleDrive) {
          throw new Error('Google Drive設定が見つかりません');
        }

        const accessToken = await getAccessToken(
          config.googleDrive.clientId,
          config.googleDrive.clientSecret
        );

        // 逆順で削除（子フォルダから先に削除）
        for (const folderId of createdFolderIds.reverse()) {
          await deleteFolder(accessToken, folderId);
        }

        console.error('   ✅ クリーンアップ完了');
      } catch (cleanupError) {
        console.error('   ⚠️  クリーンアップに失敗しました');
        console.error(`   ${cleanupError instanceof Error ? cleanupError.message : cleanupError}`);
      }
    }

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
