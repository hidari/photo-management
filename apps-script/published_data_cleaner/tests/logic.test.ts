/**
 * published-data-cleanerのロジック関数のテスト
 */

import { assertEquals } from 'jsr:@std/assert';

// テスト対象の関数を再定義（GASコードから抽出）
// 本来はsrc/から直接インポートしたいが、GAS環境とDeno環境の互換性のため、
// ここでは関数を複製している

/** PUBLISHED列のインデックス（0始まり、配列アクセス用） */
const PUBLISHED_COL_INDEX = 10;

/**
 * PUBLISHED=TRUEの行インデックスを収集する
 * @param data スプレッドシートの2次元配列データ（ヘッダーなし）
 * @returns PUBLISHED=TRUEの行インデックス配列（0始まり）
 */
function collectPublishedRowIndices(data: unknown[][]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const publishedValue = data[i][PUBLISHED_COL_INDEX];
    if (publishedValue === true || publishedValue === 'TRUE') {
      indices.push(i);
    }
  }
  return indices;
}

// ==================== テスト ====================

// --- collectPublishedRowIndices ---

Deno.test('collectPublishedRowIndices - boolean trueの行が正しく収集される', () => {
  // 11列のダミーデータ（K列=インデックス10がPUBLISHED）
  const data: unknown[][] = [
    ['001', 'a.jpg', '', '', '', '', '', '', true, '', true], // PUBLISHED=true
    ['002', 'b.jpg', '', '', '', '', '', '', true, '', false], // PUBLISHED=false
    ['003', 'c.jpg', '', '', '', '', '', '', true, '', true], // PUBLISHED=true
  ];

  const result = collectPublishedRowIndices(data);

  assertEquals(result, [0, 2]);
});

Deno.test('collectPublishedRowIndices - 文字列TRUEの行が正しく収集される', () => {
  const data: unknown[][] = [
    ['001', 'a.jpg', '', '', '', '', '', '', true, '', 'TRUE'],
    ['002', 'b.jpg', '', '', '', '', '', '', true, '', 'FALSE'],
  ];

  const result = collectPublishedRowIndices(data);

  assertEquals(result, [0]);
});

Deno.test('collectPublishedRowIndices - FALSEの行は除外される', () => {
  const data: unknown[][] = [
    ['001', 'a.jpg', '', '', '', '', '', '', true, '', false],
    ['002', 'b.jpg', '', '', '', '', '', '', true, '', false],
  ];

  const result = collectPublishedRowIndices(data);

  assertEquals(result, []);
});

Deno.test('collectPublishedRowIndices - PUBLISHED列が空の行は除外される', () => {
  const data: unknown[][] = [
    ['001', 'a.jpg', '', '', '', '', '', '', true, '', ''],
    ['002', 'b.jpg', '', '', '', '', '', '', true, '', null],
    ['003', 'c.jpg', '', '', '', '', '', '', true, '', undefined],
  ];

  const result = collectPublishedRowIndices(data);

  assertEquals(result, []);
});

Deno.test('collectPublishedRowIndices - 全行がPUBLISHED=TRUEの場合', () => {
  const data: unknown[][] = [
    ['001', 'a.jpg', '', '', '', '', '', '', true, '', true],
    ['002', 'b.jpg', '', '', '', '', '', '', true, '', true],
    ['003', 'c.jpg', '', '', '', '', '', '', true, '', true],
  ];

  const result = collectPublishedRowIndices(data);

  assertEquals(result, [0, 1, 2]);
});

Deno.test('collectPublishedRowIndices - 空のデータ配列の場合', () => {
  const data: unknown[][] = [];

  const result = collectPublishedRowIndices(data);

  assertEquals(result, []);
});

Deno.test('collectPublishedRowIndices - 混合パターン（TRUE/FALSE/空が混在）', () => {
  const data: unknown[][] = [
    ['001', 'a.jpg', '', '', '', '', '', '', true, '', false], // FALSE
    ['002', 'b.jpg', '', '', '', '', '', '', true, '', true], // TRUE
    ['003', 'c.jpg', '', '', '', '', '', '', true, '', ''], // 空
    ['004', 'd.jpg', '', '', '', '', '', '', true, '', 'TRUE'], // "TRUE"
    ['005', 'e.jpg', '', '', '', '', '', '', true, '', false], // FALSE
  ];

  const result = collectPublishedRowIndices(data);

  assertEquals(result, [1, 3]);
});

Deno.test('collectPublishedRowIndices - boolean trueと文字列TRUEが混在する場合', () => {
  const data: unknown[][] = [
    ['001', 'a.jpg', '', '', '', '', '', '', true, '', true],
    ['002', 'b.jpg', '', '', '', '', '', '', true, '', 'TRUE'],
  ];

  const result = collectPublishedRowIndices(data);

  assertEquals(result, [0, 1]);
});
