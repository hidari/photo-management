/**
 * ディレクトリ構造のビルダー
 *
 * イベント情報からディレクトリ構造オブジェクトを構築する
 */

import { basename, join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import type { ArchiveInfo } from '../../types/archive.ts';
import type { Config } from '../../types/config.ts';
import type {
  DirectoryStructure,
  DistributionConfig,
  Event,
  ModelDirectory,
} from '../../types/distribution-config.ts';

/**
 * モデルごとの写真情報
 */
export interface ModelPhotos {
  modelName: string;
  distDir: string;
  photos: string[];
  eventDate: string;
  eventName: string;
}

/**
 * イベント情報からディレクトリ構造オブジェクトを構築する
 *
 * @param event - イベント情報
 * @param appConfig - アプリケーション設定
 * @returns ディレクトリ構造オブジェクト
 */
export function buildDirectoryStructure(event: Event, appConfig: Config): DirectoryStructure {
  const { date, event_name, models } = event;
  const baseDir = appConfig.developedDirectoryBase;
  const eventDir = join(baseDir, `${date}_${event_name}`);

  const modelDirectories: ModelDirectory[] = models.map((model) => {
    const distDir = join(
      eventDir,
      `${date}_${event_name}_${appConfig.administrator}撮影_${model.name}さん`
    );
    const readmePath = join(distDir, '_README.txt');

    return {
      modelName: model.name,
      distDir,
      readmePath,
    };
  });

  return {
    baseDir,
    eventDir,
    models: modelDirectories,
  };
}

/**
 * ディレクトリ構造からDIST_DIRのパス一覧を取得する
 *
 * @param directoryConfig - TOMLから読み込んだ設定
 * @param appConfig - アプリケーション設定
 * @returns DIST_DIRのパス配列
 */
export function listDistDirectories(
  directoryConfig: DistributionConfig,
  appConfig: Config
): string[] {
  const distDirs: string[] = [];

  for (const event of directoryConfig.events) {
    const structure = buildDirectoryStructure(event, appConfig);
    for (const model of structure.models) {
      distDirs.push(model.distDir);
    }
  }

  return distDirs;
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
