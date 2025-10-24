/**
 * ディレクトリ構造のビルダー
 *
 * イベント情報からディレクトリ構造オブジェクトを構築する
 */

import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import type { Config } from '../../types/config.ts';
import type { DirectoryStructure, Event, ModelDirectory } from '../../types/distribution-config.ts';

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
    const modelDir = join(eventDir, `${model.name}さん`);
    const distDir = join(
      modelDir,
      `${date}_${event_name}_${appConfig.administrator}撮影_${model.name}さん`
    );
    const readmePath = join(distDir, '_README.txt');

    return {
      modelName: model.name,
      modelDir,
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
