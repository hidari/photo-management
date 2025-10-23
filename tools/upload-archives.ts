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
import type { ArchiveInfo } from '../types/archive.ts';
import type { DistributionConfig } from '../types/distribution-config.ts';
import { loadTomlConfig } from './lib/config-loader.ts';
import { findLatestEventDir, findTomlInEventDir } from './lib/directory-finder.ts';
import { buildDirectoryStructure } from './lib/directory-structure.ts';

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
 * gcloud CLIからアクセストークンを取得する
 *
 * @returns アクセストークン
 */
export async function getAccessTokenViaGcloud(): Promise<string> {
  try {
    const command = new Deno.Command('gcloud', {
      args: ['auth', 'application-default', 'print-access-token'],
      stdout: 'piped',
      stderr: 'piped',
    });

    const { success, stdout, stderr } = await command.output();

    if (!success) {
      const errorMsg = new TextDecoder().decode(stderr);
      // トークンのような長いランダム文字列をマスク
      const maskedError = errorMsg.replace(/[a-zA-Z0-9_-]{20,}/g, '***');
      throw new Error(`gcloudコマンドの実行に失敗: ${maskedError}`);
    }

    const token = new TextDecoder().decode(stdout).trim();

    if (!token || token.length < 20) {
      throw new Error('gcloudから有効なトークンを取得できませんでした');
    }

    return token;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        'gcloud CLIが見つかりません。\n' +
          'Google Cloud SDKをインストールしてください: https://cloud.google.com/sdk/docs/install'
      );
    }
    throw error;
  }
}

/**
 * 現在認証されているGoogleアカウントを取得する
 *
 * @returns アカウント名（取得できない場合はnull）
 */
export async function getCurrentAccount(): Promise<string | null> {
  try {
    const command = new Deno.Command('gcloud', {
      args: ['config', 'get-value', 'account'],
      stdout: 'piped',
      stderr: 'piped',
    });

    const { success, stdout } = await command.output();

    if (!success) {
      return null;
    }

    const account = new TextDecoder().decode(stdout).trim();

    // gcloudがアカウント未設定の場合は空文字か"(unset)"が返る
    if (!account || account === '(unset)') {
      return null;
    }

    return account;
  } catch {
    return null;
  }
}

/**
 * 有効なアクセストークンを取得する
 *
 * @returns アクセストークン
 */
export async function getValidToken(): Promise<string> {
  return await getAccessTokenViaGcloud();
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
  projectId: string,
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
        'X-Goog-User-Project': projectId,
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
  projectId: string,
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
      'X-Goog-User-Project': projectId,
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
export async function ensurePhotoDistributionFolder(
  accessToken: string,
  projectId: string
): Promise<string> {
  // 保存されているフォルダIDを確認
  let folderId = await loadFolderId();

  if (folderId) {
    // フォルダが実際に存在するか確認
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Goog-User-Project': projectId,
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
  folderId = await findFolder(accessToken, projectId, 'PhotoDistribution');

  if (!folderId) {
    // フォルダを作成
    console.log('📁 PhotoDistributionフォルダを作成中...');
    folderId = await createFolder(accessToken, projectId, 'PhotoDistribution');
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
  projectId: string,
  parentId: string,
  eventDate: string,
  eventName: string
): Promise<string> {
  const folderName = `${eventDate}_${eventName}`;

  // 既存のフォルダを検索
  let folderId = await findFolder(accessToken, projectId, folderName, parentId);

  if (!folderId) {
    // フォルダを作成
    console.log(`📁 イベントフォルダを作成中: ${folderName}`);
    folderId = await createFolder(accessToken, projectId, folderName, parentId);
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
  projectId: string,
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
    `--${boundary}\r\nContent-Type: application/zip\r\n\r\n`
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
        'X-Goog-User-Project': projectId,
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
export async function makeFilePublic(
  accessToken: string,
  projectId: string,
  fileId: string
): Promise<string> {
  // ファイルを公開設定にする
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Goog-User-Project': projectId,
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
  directoryConfig: DistributionConfig,
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

  // Google Cloud設定の存在確認
  if (!config.googleCloud) {
    console.error('❌ エラー: Google Cloud設定が見つかりません');
    console.error('   config.tsにgoogleCloud設定を追加してください');
    console.error('   例:');
    console.error('   googleCloud: {');
    console.error('     projectId: "your-project-id"');
    console.error('   }');
    Deno.exit(1);
  }

  // プロジェクトIDを変数に格納（型ガード後なので安全）
  const projectId = config.googleCloud.projectId;

  // gcloudの認証状態を確認
  console.log('🔍 gcloud認証を確認中...');

  try {
    await getAccessTokenViaGcloud();
    console.log('   ✅ gcloud認証済み');
  } catch (error) {
    console.error('❌ エラー: gcloud認証が必要です');
    console.error('   以下のコマンドで認証してください:');
    console.error('   $ gcloud auth application-default login \\');
    console.error(
      '       --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/drive.file'
    );
    console.error();
    console.error(`   詳細: ${error instanceof Error ? error.message : error}`);
    Deno.exit(1);
  }

  // 現在のアカウントと使用するプロジェクトを表示
  const currentAccount = await getCurrentAccount();
  if (currentAccount) {
    console.log(`   👤 認証アカウント: ${currentAccount}`);
  }
  console.log(`   📋 使用するプロジェクト: ${projectId}`);
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
    const accessToken = await getValidToken();

    // PhotoDistributionフォルダを確保
    console.log('📁 Google Driveフォルダを確認中...');
    const rootFolderId = await ensurePhotoDistributionFolder(accessToken, projectId);
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
        projectId,
        rootFolderId,
        firstArchive.eventDate,
        firstArchive.eventName
      );

      console.log(`📤 ${eventKey} のファイルをアップロード中...`);

      for (const archive of eventArchives) {
        console.log(`   • ${basename(archive.zipPath)}`);

        // ファイルをアップロード
        const fileId = await uploadFile(accessToken, projectId, archive.zipPath, eventFolderId);

        // 共有リンクを取得
        const shareUrl = await makeFilePublic(accessToken, projectId, fileId);

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
