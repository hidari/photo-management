#!/usr/bin/env deno run --allow-read --allow-write --allow-run --allow-env --allow-net --allow-sys

/**
 * アップロード統合ツール
 *
 * Google Driveへのアップロード、メッセージ生成、インテントURL生成を一括で実行する
 * デフォルトはフォルダ配布（--as-archiveでzip配布）
 *
 * 使い方:
 *   deno task upload --all                          # 全モデルをフォルダ配布
 *   deno task upload --all --as-archive             # 全モデルをzip配布
 *   deno task upload                                # 対話的に選択
 *   deno task upload --config ./path/to/config.toml # 特定のtomlを指定
 */

import { parse } from 'https://deno.land/std@0.208.0/flags/mod.ts';
import { dirname, join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import config from '../config.ts';
import type { EventModel } from '../types/distribution-config.ts';
import { createArchive, resolveArchiveTool } from './lib/archive-helper.ts';
import { ensureChrome } from './lib/browser-helper.ts';
import { loadTomlConfig } from './lib/config-loader.ts';
import { updateConfigField } from './lib/config-writer.ts';
import { findTomlConfigPath } from './lib/directory-finder.ts';
import { buildDirectoryStructure, listDistributionFiles } from './lib/directory-structure.ts';
import { getAccessToken } from './lib/google-auth.ts';
import {
  createEventFolder,
  createFolderWithParent,
  ensurePhotoDistributionFolder,
  makeFilePublic,
  makeFolderPublic,
  uploadFile,
} from './lib/google-drive-helper.ts';
import { cleanUsername } from './lib/sns-utils.ts';
import { renderModelTemplate } from './lib/template-renderer.ts';
import { updateModelFields } from './lib/toml-writer.ts';
import { buildIntentUrl, getUserIdFromUsername } from './lib/x-helper.ts';

/**
 * 標準入力から1行読み取る
 */
function readLine(message: string, defaultValue?: string): string {
  const displayMessage = defaultValue ? `${message} [${defaultValue}]` : message;
  const input = prompt(displayMessage);

  if (input === null) {
    Deno.exit(0);
  }

  return input.trim() || defaultValue || '';
}

/**
 * Yes/No質問
 */
function confirm(message: string, defaultValue = true): boolean {
  const defaultStr = defaultValue ? 'Y/n' : 'y/N';
  const input = readLine(`${message} (${defaultStr}):`, defaultValue ? 'y' : 'n').toLowerCase();
  return input === 'y' || input === 'yes';
}

/**
 * 対象モデルを選択
 */
function selectTargetModels(models: EventModel[], allFlag: boolean): EventModel[] {
  if (allFlag) {
    return models;
  }

  console.log('📋 アップロード対象を選択してください:');
  console.log();

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const status = model.download_url ? '✅ アップロード済み' : '⏳ 未アップロード';
    console.log(`  ${i + 1}. ${model.name}さん (${status})`);
  }

  console.log();
  const selection = readLine('アップロードするモデルの番号（カンマ区切り、allで全選択）:', 'all');

  if (selection.toLowerCase() === 'all') {
    return models;
  }

  const indices = selection.split(',').map((s) => Number.parseInt(s.trim(), 10) - 1);
  return indices.filter((i) => i >= 0 && i < models.length).map((i) => models[i]);
}

/**
 * ZIP配布: アップロード処理
 */
async function uploadAsArchive(
  distDir: string,
  modelName: string,
  eventDate: string,
  eventName: string,
  accessToken: string,
  eventFolderId: string,
  archiveTool: string,
  deleteAfterUpload: boolean
): Promise<string> {
  // 1. アーカイブ作成
  console.log(`  アーカイブ作成中...`);
  await createArchive(distDir, archiveTool);

  // zipファイルパスを構築
  const zipFileName = `${eventDate}_${eventName}_${config.administrator}撮影_${modelName}さん.zip`;
  const zipPath = join(dirname(distDir), zipFileName);

  // 2. Google Driveにアップロード
  console.log(`  Google Driveにアップロード中...`);
  const fileId = await uploadFile(accessToken, zipPath, eventFolderId);

  // 3. 公開設定してURLを取得
  console.log(`  共有URLを取得中...`);
  const downloadUrl = await makeFilePublic(accessToken, fileId);

  // 4. オプション: ローカルzipを削除
  if (deleteAfterUpload) {
    try {
      await Deno.remove(zipPath);
      console.log(`  ローカルzipを削除しました`);
    } catch (error) {
      console.log(`  ⚠️ ローカルzip削除に失敗: ${error}`);
    }
  }

  return downloadUrl;
}

/**
 * フォルダ配布: アップロード処理
 */
async function uploadAsFolder(
  distDir: string,
  modelName: string,
  eventDate: string,
  eventName: string,
  accessToken: string,
  eventFolderId: string
): Promise<string> {
  // 1. 配布ファイルを検索（写真ファイル + _README.txt）
  console.log(`  配布ファイルを検索中...`);
  const distributionFiles = await listDistributionFiles(distDir);

  // 写真ファイルのみをカウント
  const photoCount = distributionFiles.filter((filePath) => {
    const ext = filePath.toLowerCase().split('.').pop();
    return ext && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
  }).length;

  if (photoCount === 0) {
    throw new Error(`写真ファイルが見つかりません: ${distDir}`);
  }

  console.log(`  ${photoCount}枚の写真を発見しました`);

  // 2. モデル用フォルダを作成
  console.log(`  モデル用フォルダを作成中...`);
  const modelFolderId = await createFolderWithParent(
    accessToken,
    `${eventDate}_${eventName}_${config.administrator}撮影_${modelName}さん`,
    eventFolderId
  );

  // 3. 配布ファイルを個別にアップロード
  console.log(`  ファイルをアップロード中...`);
  for (let i = 0; i < distributionFiles.length; i++) {
    const filePath = distributionFiles[i];
    await uploadFile(accessToken, filePath, modelFolderId);

    // 進捗表示
    if ((i + 1) % 10 === 0 || i === distributionFiles.length - 1) {
      console.log(`      ${i + 1}/${distributionFiles.length}ファイル 完了`);
    }
  }

  // 4. フォルダを公開設定してURLを取得
  console.log(`  共有URLを取得中...`);
  const downloadUrl = await makeFolderPublic(accessToken, modelFolderId);

  return downloadUrl;
}

/**
 * 配布メッセージを生成
 */
async function generateDistributionMessage(
  modelName: string,
  eventName: string,
  downloadUrl: string,
  outreach: boolean
): Promise<string> {
  const templatePath = outreach
    ? './templates/MODEL_OUTREACH.eta'
    : './templates/MODEL_FOLLOW_UP.eta';

  return await renderModelTemplate(templatePath, modelName, eventName, downloadUrl);
}

/**
 * インテントURLを生成
 */
async function generateIntentUrl(
  modelName: string,
  eventName: string,
  message: string,
  snsUrl: string
): Promise<string | null> {
  // SNSがXかどうか確認
  if (!snsUrl.includes('twitter.com') && !snsUrl.includes('x.com')) {
    console.log(`  SNSがX以外のため、インテントURL生成をスキップします`);
    return null;
  }

  try {
    // ユーザー名を抽出
    const username = cleanUsername(snsUrl);

    // Puppeteerでユーザー IDを取得
    console.log(`  ユーザーID取得中 (@${username})...`);
    const userId = await getUserIdFromUsername(username);

    if (!userId) {
      console.log(`  ⚠️ ユーザーIDが取得できませんでした`);
      return null;
    }

    // インテントURLを構築
    const intentUrl = buildIntentUrl(userId, message, modelName, eventName);

    return intentUrl;
  } catch (error) {
    console.log(`  ⚠️ インテントURL生成エラー: ${error}`);
    return null;
  }
}

/**
 * 1モデル分の全処理を実行
 */
async function processModel(
  model: EventModel,
  eventDate: string,
  eventName: string,
  distDir: string,
  tomlPath: string,
  accessToken: string,
  eventFolderId: string,
  asArchive: boolean,
  archiveTool: string | null,
  deleteAfterUpload: boolean
): Promise<void> {
  console.log(`\n${model.name}さん の処理を開始`);
  console.log('-'.repeat(50));

  try {
    // 既にアップロード済みの場合は確認
    if (model.download_url) {
      console.log(`  ⚠️ 既にアップロード済みです`);
      const overwrite = confirm('  上書きしますか?', false);
      if (!overwrite) {
        console.log(`  スキップしました`);
        return;
      }
    }

    // 1. アップロード処理
    let downloadUrl: string;

    if (asArchive) {
      if (!archiveTool) {
        throw new Error('アーカイブツールが設定されていません');
      }
      downloadUrl = await uploadAsArchive(
        distDir,
        model.name,
        eventDate,
        eventName,
        accessToken,
        eventFolderId,
        archiveTool,
        deleteAfterUpload
      );
    } else {
      downloadUrl = await uploadAsFolder(
        distDir,
        model.name,
        eventDate,
        eventName,
        accessToken,
        eventFolderId
      );
    }

    console.log(`  ✅ アップロード完了`);

    // 2. 配布メッセージ生成
    console.log(`  配布メッセージ生成中...`);
    const message = await generateDistributionMessage(
      model.name,
      eventName,
      downloadUrl,
      model.outreach
    );
    console.log(`  ✅ メッセージ生成完了`);

    // 3. インテントURL生成（SNSがXの場合のみ）
    let intentUrl: string | null = null;
    if (model.sns) {
      console.log(`  インテントURL生成中...`);
      intentUrl = await generateIntentUrl(model.name, eventName, message, model.sns);
      if (intentUrl) {
        console.log(`  ✅ インテントURL生成完了`);
      }
    }

    // 4. TOMLファイルを更新
    console.log(`  設定ファイルを更新中...`);
    const updateFields: Partial<EventModel> = {
      download_url: downloadUrl,
      message,
    };
    if (intentUrl) {
      updateFields.intent_url = intentUrl;
    }

    const updatedToml = await updateModelFields(tomlPath, model.name, updateFields);
    await Deno.writeTextFile(tomlPath, updatedToml);

    console.log(`  ✅ ${model.name}さん の処理が完了しました`);

    // Bot対策: ランダム待機（次のモデルがいる場合）
    const delay = Math.floor(Math.random() * 3000) + 2000; // 2-5秒
    await new Promise((resolve) => setTimeout(resolve, delay));
  } catch (error) {
    console.error(`  ❌ ${model.name}さん の処理中にエラーが発生しました`);
    if (error instanceof Error) {
      console.error(`    ${error.message}`);
    }
    throw error;
  }
}

/**
 * メイン処理
 */
async function main() {
  const args = parse(Deno.args, {
    string: ['config'],
    boolean: ['all', 'as-archive', 'delete-after-upload'],
    default: {
      all: false,
      'as-archive': false,
      'delete-after-upload': false,
    },
  });

  console.log('アップロード統合ツール');
  console.log('='.repeat(50));
  console.log();

  try {
    // tomlファイルのパスを取得
    let tomlPath: string;
    if (args.config) {
      tomlPath = args.config;
      console.log(`設定ファイル: ${tomlPath}`);
    } else {
      console.log('最新イベントの設定ファイルを検索しています...');
      tomlPath = await findTomlConfigPath(config);
      console.log(`✅ 見つかりました: ${tomlPath}`);
    }

    // tomlファイルを読み込み
    const distributionConfig = await loadTomlConfig(tomlPath);

    if (distributionConfig.events.length === 0) {
      console.error('❌ イベント情報が見つかりません');
      Deno.exit(1);
    }

    const event = distributionConfig.events[0];
    console.log();
    console.log(`イベント: ${event.event_name} (${event.date})`);
    console.log(`モデル数: ${event.models.length}人`);
    console.log();

    // アップロード方式を表示
    const asArchive = args['as-archive'];
    if (asArchive) {
      console.log('アップロード方式: ZIP配布');
    } else {
      console.log('アップロード方式: フォルダ配布（デフォルト）');
    }
    console.log();

    // アップロード対象を選択
    const targetModels = selectTargetModels(event.models, args.all);

    if (targetModels.length === 0) {
      console.log('アップロード対象がありません');
      return;
    }

    console.log(`${targetModels.length}人のモデルをアップロードします`);
    console.log();

    // アーカイブツールの準備（ZIP配布の場合のみ）
    let archiveTool: string | null = null;
    if (asArchive) {
      console.log('アーカイブツールを準備しています...');
      archiveTool = await resolveArchiveTool(config);
      console.log(`✅ 使用ツール: ${archiveTool}`);
      console.log();
    }

    // Google Drive認証
    console.log('Google Driveに認証中...');
    if (!config.googleDrive) {
      console.error('❌ config.tsにGoogle Drive設定が見つかりません');
      console.error('   config.tsのgoogleDriveセクションを設定してください');
      Deno.exit(1);
    }

    const accessToken = await getAccessToken(
      config.googleDrive.clientId,
      config.googleDrive.clientSecret
    );
    console.log('✅ 認証完了');
    console.log();

    // PhotoDistributionフォルダを確保
    console.log('Google Driveフォルダ構造を確保中...');
    const currentFolderId = config.photoDistributionFolderId;
    console.log(`  [DEBUG] 設定されているフォルダID: ${currentFolderId || 'なし'}`);
    const photoDistFolderId = await ensurePhotoDistributionFolder(accessToken, currentFolderId);

    // フォルダIDが変更された場合は config.ts に保存
    if (currentFolderId !== photoDistFolderId) {
      await updateConfigField('photoDistributionFolderId', photoDistFolderId);
      console.log(`  [DEBUG] フォルダIDをconfig.tsに保存しました: ${photoDistFolderId}`);
    }

    console.log(`✅ PhotoDistributionフォルダ: ${photoDistFolderId}`);

    // イベントフォルダを作成
    const eventFolderId = await createEventFolder(
      accessToken,
      photoDistFolderId,
      event.date,
      event.event_name
    );
    console.log();

    // Puppeteerの準備（X連携モデルがいる場合のみ）
    const hasXModels = targetModels.some(
      (m) => m.sns && (m.sns.includes('twitter.com') || m.sns.includes('x.com'))
    );

    if (hasXModels) {
      console.log('Puppeteer（Chrome）を準備中...');
      await ensureChrome();
      console.log('✅ Puppeteer準備完了');
      console.log();
    }

    // ディレクトリ構造を構築（distDirパスの取得用）
    const structure = buildDirectoryStructure(event, config);

    // 各モデルを処理
    let successCount = 0;
    const skipCount = 0;
    let failCount = 0;

    for (let i = 0; i < targetModels.length; i++) {
      const model = targetModels[i];

      // distDirを取得
      const modelDir = structure.models.find((m) => m.modelName === model.name);
      if (!modelDir) {
        console.error(`❌ ${model.name}さん のディレクトリが見つかりません`);
        failCount++;
        continue;
      }

      try {
        await processModel(
          model,
          event.date,
          event.event_name,
          modelDir.distDir,
          tomlPath,
          accessToken,
          eventFolderId,
          asArchive,
          archiveTool,
          args['delete-after-upload']
        );
        successCount++;
      } catch (_error) {
        console.error(`  処理を中断しました`);
        failCount++;

        // 他のモデルは続行するか確認
        if (i < targetModels.length - 1) {
          const shouldContinue = confirm('\n他のモデルの処理を続行しますか?', true);
          if (!shouldContinue) {
            break;
          }
        }
      }
    }

    // サマリー表示
    console.log();
    console.log('='.repeat(50));
    console.log('処理結果サマリー');
    console.log('-'.repeat(50));
    console.log(`✅ 成功: ${successCount}人`);
    if (skipCount > 0) {
      console.log(`  スキップ: ${skipCount}人`);
    }
    if (failCount > 0) {
      console.log(`❌ 失敗: ${failCount}人`);
    }
    console.log('='.repeat(50));
    console.log();

    if (successCount > 0) {
      console.log('✅ アップロード処理が完了しました');
      console.log();
      console.log('次のステップ:');
      console.log('  deno task ship で各モデルに配布メッセージを送信してください');
    }
  } catch (error) {
    console.error();
    if (error instanceof Error) {
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
