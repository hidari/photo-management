/**
 * cleanup-schedulerのロジック関数のテスト
 */

import { assertEquals } from 'jsr:@std/assert';

// テスト対象の関数を再定義（GASコードから抽出）
// 本来はsrc/から直接インポートしたいが、GAS環境とDeno環境の互換性のため、
// ここでは関数を複製している

/**
 * イベントフォルダの情報
 */
class EventFolderInfo {
  id: string;
  name: string;
  createdTime: Date;
  daysOld: number;

  constructor(id: string, name: string, createdTime: Date, daysOld: number) {
    this.id = id;
    this.name = name;
    this.createdTime = createdTime;
    this.daysOld = daysOld;
  }
}

/**
 * 2つの日付から経過日数を計算する
 */
function calculateDaysOld(now: Date, createdTime: Date): number {
  return Math.floor((now.getTime() - createdTime.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 指定した日数より古いフォルダを抽出する
 */
function filterOldFolders(folders: EventFolderInfo[], retentionDays: number): EventFolderInfo[] {
  return folders.filter((folder) => folder.daysOld > retentionDays);
}

// ==================== テスト ====================

Deno.test('calculateDaysOld - 同じ日付の場合は0日', () => {
  const now = new Date('2024-01-15T12:00:00Z');
  const createdTime = new Date('2024-01-15T10:00:00Z');

  const result = calculateDaysOld(now, createdTime);

  assertEquals(result, 0);
});

Deno.test('calculateDaysOld - 1日前の場合は1日', () => {
  const now = new Date('2024-01-15T12:00:00Z');
  const createdTime = new Date('2024-01-14T12:00:00Z');

  const result = calculateDaysOld(now, createdTime);

  assertEquals(result, 1);
});

Deno.test('calculateDaysOld - 30日前の場合は30日', () => {
  const now = new Date('2024-01-15T12:00:00Z');
  const createdTime = new Date('2023-12-16T12:00:00Z');

  const result = calculateDaysOld(now, createdTime);

  assertEquals(result, 30);
});

Deno.test('calculateDaysOld - 時刻の違いは切り捨て', () => {
  const now = new Date('2024-01-15T23:59:59Z');
  const createdTime = new Date('2024-01-15T00:00:00Z');

  const result = calculateDaysOld(now, createdTime);

  assertEquals(result, 0);
});

Deno.test('calculateDaysOld - 365日前の場合は365日', () => {
  const now = new Date('2024-01-15T12:00:00Z');
  const createdTime = new Date('2023-01-15T12:00:00Z');

  const result = calculateDaysOld(now, createdTime);

  assertEquals(result, 365);
});

Deno.test('filterOldFolders - 保持期間内のフォルダは除外される', () => {
  const folders = [
    new EventFolderInfo('1', 'Folder1', new Date(), 5),
    new EventFolderInfo('2', 'Folder2', new Date(), 10),
    new EventFolderInfo('3', 'Folder3', new Date(), 15),
  ];

  const result = filterOldFolders(folders, 10);

  assertEquals(result.length, 1);
  assertEquals(result[0].name, 'Folder3');
});

Deno.test('filterOldFolders - ちょうど保持期間のフォルダは除外される', () => {
  const folders = [new EventFolderInfo('1', 'Folder1', new Date(), 10)];

  const result = filterOldFolders(folders, 10);

  assertEquals(result.length, 0);
});

Deno.test('filterOldFolders - 空の配列を渡すと空の配列が返る', () => {
  const folders: EventFolderInfo[] = [];

  const result = filterOldFolders(folders, 10);

  assertEquals(result.length, 0);
});

Deno.test('filterOldFolders - すべてのフォルダが古い場合はすべて返される', () => {
  const folders = [
    new EventFolderInfo('1', 'Folder1', new Date(), 15),
    new EventFolderInfo('2', 'Folder2', new Date(), 20),
    new EventFolderInfo('3', 'Folder3', new Date(), 25),
  ];

  const result = filterOldFolders(folders, 10);

  assertEquals(result.length, 3);
});

Deno.test('filterOldFolders - 複数の条件でフィルタリング', () => {
  const folders = [
    new EventFolderInfo('1', 'Folder1', new Date(), 5),
    new EventFolderInfo('2', 'Folder2', new Date(), 30),
    new EventFolderInfo('3', 'Folder3', new Date(), 45),
    new EventFolderInfo('4', 'Folder4', new Date(), 60),
  ];

  const result = filterOldFolders(folders, 30);

  assertEquals(result.length, 2);
  assertEquals(result[0].name, 'Folder3');
  assertEquals(result[1].name, 'Folder4');
});

Deno.test('EventFolderInfo - コンストラクタで正しく初期化される', () => {
  const id = 'test-id';
  const name = 'Test Folder';
  const createdTime = new Date('2024-01-01T00:00:00Z');
  const daysOld = 10;

  const folder = new EventFolderInfo(id, name, createdTime, daysOld);

  assertEquals(folder.id, id);
  assertEquals(folder.name, name);
  assertEquals(folder.createdTime, createdTime);
  assertEquals(folder.daysOld, daysOld);
});
