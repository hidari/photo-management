/**
 * X（Twitter）連携ライブラリ
 *
 * XのユーザーID取得とDMインテントURL生成機能を提供する
 */

import puppeteer from 'npm:puppeteer';
import { cleanUsername } from './sns-utils.ts';

// 制限値
const MAX_EVENT_NAME_LENGTH = 30;
const MAX_MODEL_NAME_LENGTH = 50;
const MAX_INTENT_URL_LENGTH = 1800;

/**
 * XのユーザーページからユーザーIDを取得する
 *
 * @param username - Xのユーザー名（@なし）
 * @returns ユーザーID（取得失敗時はnull）
 */
export async function getUserIdFromUsername(username: string): Promise<string | null> {
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
export function buildIntentUrl(
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
