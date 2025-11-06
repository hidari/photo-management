/**
 * イベント初期化ツール（init.ts）のテスト
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { validateDate } from '../tools/init.ts';

/**
 * 日付バリデーションの正常系テスト
 */
Deno.test('validateDate: 正しい日付形式（YYYYMMDD）を受け入れる', () => {
  assertEquals(validateDate('20251012'), true);
  assertEquals(validateDate('20250101'), true);
  assertEquals(validateDate('20251231'), true);
  assertEquals(validateDate('20240229'), true); // うるう年
});

/**
 * 日付バリデーションの異常系テスト: 形式エラー
 */
Deno.test('validateDate: 不正な形式を拒否する', () => {
  assertEquals(validateDate('2025-10-12'), false); // ハイフンあり
  assertEquals(validateDate('20251012 '), false); // 末尾にスペース
  assertEquals(validateDate('202510'), false); // 6桁
  assertEquals(validateDate('202510123'), false); // 9桁
  assertEquals(validateDate('abcd1012'), false); // 英字混在
  assertEquals(validateDate(''), false); // 空文字
});

/**
 * 日付バリデーションの異常系テスト: 存在しない日付
 */
Deno.test('validateDate: 存在しない日付を拒否する', () => {
  assertEquals(validateDate('20251301'), false); // 13月
  assertEquals(validateDate('20250001'), false); // 0月
  assertEquals(validateDate('20251032'), false); // 32日
  assertEquals(validateDate('20251100'), false); // 0日
  assertEquals(validateDate('20230229'), false); // 非うるう年の2/29
  assertEquals(validateDate('20250431'), false); // 4月31日（存在しない）
});

/**
 * 日付バリデーションのエッジケーステスト
 */
Deno.test('validateDate: エッジケースを正しく処理する', () => {
  // 各月の最終日
  assertEquals(validateDate('20250131'), true); // 1月31日
  assertEquals(validateDate('20250228'), true); // 平年2月28日
  assertEquals(validateDate('20240229'), true); // うるう年2月29日
  assertEquals(validateDate('20250331'), true); // 3月31日
  assertEquals(validateDate('20250430'), true); // 4月30日
  assertEquals(validateDate('20250531'), true); // 5月31日
  assertEquals(validateDate('20250630'), true); // 6月30日
  assertEquals(validateDate('20250731'), true); // 7月31日
  assertEquals(validateDate('20250831'), true); // 8月31日
  assertEquals(validateDate('20250930'), true); // 9月30日
  assertEquals(validateDate('20251031'), true); // 10月31日
  assertEquals(validateDate('20251130'), true); // 11月30日
  assertEquals(validateDate('20251231'), true); // 12月31日
});
