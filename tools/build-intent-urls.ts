#!/usr/bin/env deno run --allow-read --allow-write --allow-net --allow-env --allow-run --allow-sys

/**
 * XのDMインテントURL生成ツール
 *
 * このスクリプトは、イベントディレクトリのdistribution.config.tomlを参照して
 * 各モデルのXアカウントからユーザーIDを取得し、DMインテントURLを生成してTOMLに追記する
 *
 * 使い方:
 *   deno task intent
 */

import { parse as parseFlags } from 'https://deno.land/std@0.208.0/flags/mod.ts';
import { exists } from 'https://deno.land/std@0.208.0/fs/mod.ts';
import puppeteer from 'npm:puppeteer';
import config from '../config.ts';
import type { DistributionConfig } from '../types/distribution-config.ts';
import { loadTomlConfig } from './lib/config-loader.ts';
import { findLatestEventDir, findTomlInEventDir } from './lib/directory-finder.ts';
import { cleanUsername } from './lib/sns-utils.ts';
import { configToToml } from './lib/toml-writer.ts';

// 制限値
const MAX_EVENT_NAME_LENGTH = 30;
const MAX_MODEL_NAME_LENGTH = 50;
const MAX_INTENT_URL_LENGTH = 1800;

// Bot判定回避用の待機時間（ミリ秒）
const MIN_DELAY_MS = 2000; // 最小2秒
const MAX_DELAY_MS = 5000; // 最大5秒

/**
 * ランダムな時間待機する
 *
 * @param minMs - 最小待機時間（ミリ秒）
 * @param maxMs - 最大待機時間（ミリ秒）
 */
async function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(`   ⏱️  待機中... (${(delay / 1000).toFixed(1)}秒)`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Puppeteerが必要とするChromeがインストールされているかチェックし、
 * なければ自動でダウンロードする関数
 */
async function ensureChrome(): Promise<void> {
  const homedir = Deno.env.get('HOME') || Deno.env.get('USERPROFILE');
  const cacheDir = `${homedir}/.cache/puppeteer`;

  console.log('   関連ツールのインストール状況を確認中...');

  const cacheExists = await exists(cacheDir);

  if (!cacheExists) {
    console.log('   関連ツールが見つかりません。ダウンロードを開始します...');

    const command = new Deno.Command('deno', {
      args: [
        'run',
        '-A',
        'npm:@puppeteer/browsers',
        'install',
        'chrome@stable',
        '--path',
        cacheDir,
      ],
      stdout: 'inherit',
      stderr: 'inherit',
    });

    const { code } = await command.output();

    if (code !== 0) {
      throw new Error(`関連ツールのインストールに失敗しました（終了コード: ${code}）`);
    }

    console.log('   ✓ 関連ツールのダウンロードが完了しました！');
  } else {
    console.log('   ✓ 既にインストールされています');
  }
}

/**
 * XのユーザーページからユーザーIDを取得する
 *
 * @param username - Xのユーザー名（@なし）
 * @returns ユーザーID（取得失敗時はnull）
 */
async function getUserIdFromUsername(username: string): Promise<string | null> {
  const browser = await puppeteer.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
    );

    const cleanName = cleanUsername(username);

    await page.goto(`https://twitter.com/${cleanName}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // JSON-LDスクリプトタグが表示されるまで待つ
    try {
      await page.waitForSelector('script[type="application/ld+json"]', {
        timeout: 5000,
      });
    } catch (_error) {
      // 見つからなくても処理を続ける
    }

    return await page.evaluate(() => {
      // @ts-expect-error - documentはブラウザコンテキストで実行されるため型エラーを無視
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');

      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');

          if (data.mainEntity?.identifier) {
            return data.mainEntity.identifier;
          }

          if (data.author?.identifier) {
            return data.author.identifier;
          }
        } catch (_e) {
          // JSON解析エラーは無視
        }
      }

      return null;
    });
  } catch (error) {
    console.error(`   ⚠️  エラー: ${error instanceof Error ? error.message : error}`);
    return null;
  } finally {
    await browser.close();
  }
}

/**
 * DMインテントURLを構築する
 *
 * @param userId - XのユーザーID
 * @param message - DMメッセージ
 * @param modelName - モデル名（検証用）
 * @param eventName - イベント名（検証用）
 * @returns インテントURL
 * @throws 制限を超えている場合はエラー
 */
function buildIntentUrl(
  userId: string,
  message: string,
  modelName: string,
  eventName: string
): string {
  // 名前の長さチェック
  if (eventName.length > MAX_EVENT_NAME_LENGTH) {
    throw new Error(
      `イベント名が長すぎます: ${eventName.length}文字（最大${MAX_EVENT_NAME_LENGTH}文字）`
    );
  }

  if (modelName.length > MAX_MODEL_NAME_LENGTH) {
    throw new Error(
      `モデル名が長すぎます: ${modelName.length}文字（最大${MAX_MODEL_NAME_LENGTH}文字）`
    );
  }

  // URLエンコード
  const encodedMessage = encodeURIComponent(message);

  // インテントURL構築
  const intentUrl = `https://twitter.com/messages/compose?recipient_id=${userId}&text=${encodedMessage}`;

  // URL長チェック
  if (intentUrl.length > MAX_INTENT_URL_LENGTH) {
    throw new Error(
      `生成されたインテントURLが長すぎます: ${intentUrl.length}文字（最大${MAX_INTENT_URL_LENGTH}文字）\n` +
        `   モデル: ${modelName}\n` +
        `   メッセージ長: ${message.length}文字、エンコード後: ${encodedMessage.length}文字\n` +
        `   テンプレートを短縮するか、イベント名・モデル名を短くしてください`
    );
  }

  return intentUrl;
}

/**
 * TOMLファイルにインテントURLを追記する
 *
 * @param tomlPath - TOMLファイルのパス
 * @param distributionConfig - ディレクトリ設定
 */
async function updateTomlWithIntentUrls(
  tomlPath: string,
  distributionConfig: DistributionConfig
): Promise<void> {
  // Chrome確保
  await ensureChrome();

  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // 総モデル数を計算（待機処理判定用）
  const totalModels = distributionConfig.events.reduce(
    (sum, event) => sum + event.models.length,
    0
  );
  let currentModelIndex = 0;

  for (const event of distributionConfig.events) {
    for (const model of event.models) {
      currentModelIndex++;
      console.log(`\n   📝 処理中: ${model.name}`);

      // download_urlとmessageが存在しない場合はスキップ
      if (!model.download_url || !model.message) {
        console.warn(
          `   ⚠️  スキップ: モデル「${model.name}」のdownload_urlまたはmessageが未設定です`
        );
        skippedCount++;
        continue;
      }

      // SNSフィールドが存在しない場合はスキップ
      if (!model.sns) {
        console.warn(`   ⚠️  スキップ: モデル「${model.name}」のSNSアカウントが未設定です`);
        skippedCount++;
        continue;
      }

      // ユーザー名を抽出
      const username = cleanUsername(model.sns);
      console.log(`   🔍 ユーザー名: @${username}`);

      // ユーザーIDを取得
      console.log(`   🌐 プロフィールページから情報を取得中...`);
      const userId = await getUserIdFromUsername(username);

      if (!userId) {
        console.error(
          `   ❌ スキップ: ユーザーID取得に失敗しました（アカウントが存在しないか非公開の可能性があります）`
        );
        errorCount++;
        continue;
      }

      console.log(`   ✓ ユーザーID: ${userId}`);

      // インテントURLを構築
      try {
        const intentUrl = buildIntentUrl(userId, model.message, model.name, event.event_name);
        model.intent_url = intentUrl;
        console.log(`   ✓ インテントURL生成完了（${intentUrl.length}文字）`);
        processedCount++;
      } catch (error) {
        console.error(
          `   ❌ エラー: インテントURL生成に失敗しました\n   ${error instanceof Error ? error.message : error}`
        );
        throw error; // URL長制限エラーは処理全体を中断
      }

      // Bot判定回避のためランダム待機（最後のモデル以外）
      if (currentModelIndex < totalModels) {
        await randomDelay(MIN_DELAY_MS, MAX_DELAY_MS);
      }
    }
  }

  // 結果サマリー
  console.log('\n📊 処理結果:');
  console.log(`   成功: ${processedCount}件`);
  if (skippedCount > 0) {
    console.log(`   スキップ: ${skippedCount}件`);
  }
  if (errorCount > 0) {
    console.log(`   失敗: ${errorCount}件`);
  }

  // TOMLファイルに書き込み
  const tomlContent = configToToml(distributionConfig);
  await Deno.writeTextFile(tomlPath, tomlContent);
}

/**
 * スクリプトエントリーポイント
 */
async function main() {
  const args = parseFlags(Deno.args, {
    string: ['event-dir', 'config'],
  });

  console.log('🔗 XのDMインテントURLを生成してTOMLファイルに追記します...');
  console.log();

  try {
    let eventDir: string | null;
    let tomlPath: string | null = null;

    // イベントディレクトリを特定
    if (args['event-dir']) {
      eventDir = args['event-dir'];
      console.log(`   イベントディレクトリ（指定）: ${eventDir}`);
    } else {
      eventDir = await findLatestEventDir(config.developedDirectoryBase);
      if (!eventDir) {
        throw new Error(
          `イベントディレクトリが見つかりませんでした: ${config.developedDirectoryBase}`
        );
      }
      console.log(`   イベントディレクトリ（自動検出）: ${eventDir}`);
    }

    // TOMLファイルを特定
    if (args.config) {
      tomlPath = args.config;
      console.log(`   設定ファイル（指定）: ${tomlPath}`);
    } else {
      tomlPath = await findTomlInEventDir(eventDir);
      if (!tomlPath) {
        throw new Error(`TOMLファイルが見つかりませんでした: ${eventDir}`);
      }
      console.log(`   設定ファイル（自動検出）: ${tomlPath}`);
    }

    // TOMLファイルを読み込み
    const distributionConfig = await loadTomlConfig(tomlPath);

    // インテントURLを生成してTOMLファイルに追記
    await updateTomlWithIntentUrls(tomlPath, distributionConfig);

    console.log();
    console.log(`✅ インテントURLをTOMLファイルに追記しました: ${tomlPath}`);
  } catch (error) {
    console.error('\n❌ エラー:', error instanceof Error ? error.message : error);
    Deno.exit(1);
  }
}

// このファイルが直接実行された場合のみ、main関数を実行する
if (import.meta.main) {
  main();
}
