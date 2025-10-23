/**
 * TOML設定ファイルのローダー
 *
 * イベント設定TOMLファイルの読み込みとバリデーションを提供する
 */

import { parse as parseToml } from 'https://deno.land/std@0.208.0/toml/mod.ts';
import type { DistributionConfig } from '../../types/distribution-config.ts';

/**
 * TOMLファイルを読み込んでパースする
 *
 * @param tomlPath - TOMLファイルのパス
 * @returns パース済みの設定オブジェクト
 */
export async function loadTomlConfig(tomlPath: string): Promise<DistributionConfig> {
  const content = await Deno.readTextFile(tomlPath);
  const parsed = parseToml(content) as unknown as DistributionConfig;

  // 基本的なバリデーション
  if (!parsed.events || !Array.isArray(parsed.events) || parsed.events.length === 0) {
    throw new Error('TOMLファイルにeventsが定義されていないか、空です');
  }

  return parsed;
}
