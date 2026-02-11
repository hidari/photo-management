/**
 * 投稿済みデータクリーナー
 *
 * スプレッドシートにバインドされたGoogle Apps Scriptで、
 * PUBLISHED=TRUEのレコードを「published」シートに移動する機能を提供します。
 *
 * ビルド設計:
 * - tsconfig.json の outDir は ../message-generator/dist を向いている
 * - message-generatorと同じGASプロジェクトとして統合するため、
 *   コンパイル出力を message-generator/dist に配置する
 * - GASでは全ファイルがグローバルスコープにマージされるため、
 *   movePublishedData() は message-generator の onOpen() から呼び出される
 * - デプロイ: deno task gas:apply-message-generator
 */

/** publishedシートの名前 */
const PUBLISHED_SHEET_NAME = 'published';

/** データ開始行（ヘッダーの次） */
const DATA_START_ROW = 2;

/** 列数（A〜K列） */
const TOTAL_COLUMNS = 11;

/** PUBLISHED列のインデックス（0始まり、配列アクセス用） */
const PUBLISHED_COL_INDEX = 10;

/**
 * PUBLISHED=TRUEの行をpublishedシートに移動する
 * カスタムメニューから手動実行される
 */
// biome-ignore lint/correctness/noUnusedVariables: GAS環境でグローバル関数として使用される
function movePublishedData(): void {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = spreadsheet.getActiveSheet();

    // アクティブシートがpublishedシートの場合はエラー
    if (sourceSheet.getName() === PUBLISHED_SHEET_NAME) {
      Browser.msgBox('publishedシートからは実行できません。元のデータシートから実行してください。');
      return;
    }

    const lastRow = sourceSheet.getLastRow();

    // ヘッダー行のみの場合は終了
    if (lastRow <= 1) {
      Browser.msgBox('データが存在しません。');
      return;
    }

    // 全データを取得（ヘッダー行を除く）
    const dataRange = sourceSheet.getRange(DATA_START_ROW, 1, lastRow - 1, TOTAL_COLUMNS);
    const data = dataRange.getValues();

    // PUBLISHED=TRUEの行インデックスを収集
    const publishedRowIndices = collectPublishedRowIndices(data);

    if (publishedRowIndices.length === 0) {
      Browser.msgBox('移動対象の投稿済みデータはありません。');
      return;
    }

    // publishedシートを取得または作成
    const publishedSheet = getOrCreatePublishedSheet(spreadsheet, sourceSheet);

    // publishedシートにデータを追加
    appendRowsToPublishedSheet(publishedSheet, data, publishedRowIndices);

    // 元シートから行を削除（下から上に向かって削除）
    deleteRowsFromSource(sourceSheet, publishedRowIndices);

    Browser.msgBox(
      `${publishedRowIndices.length}件の投稿済みデータをpublishedシートに移動しました。`
    );
    Logger.log(
      `投稿済みデータ移動完了: ${publishedRowIndices.length}件をpublishedシートに移動しました`
    );
  } catch (error) {
    Browser.msgBox(
      `エラーが発生しました:\n${error instanceof Error ? error.message : String(error)}`
    );
    Logger.log(
      `投稿済みデータ移動エラー: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

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

/**
 * publishedシートを取得、存在しない場合は作成する
 * @param spreadsheet スプレッドシート
 * @param sourceSheet 元シート（ヘッダーコピー用）
 * @returns publishedシート
 */
function getOrCreatePublishedSheet(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sourceSheet: GoogleAppsScript.Spreadsheet.Sheet
): GoogleAppsScript.Spreadsheet.Sheet {
  let publishedSheet = spreadsheet.getSheetByName(PUBLISHED_SHEET_NAME);

  if (publishedSheet === null) {
    publishedSheet = spreadsheet.insertSheet(PUBLISHED_SHEET_NAME);

    // ヘッダー行をコピー
    const headerValues = sourceSheet.getRange(1, 1, 1, TOTAL_COLUMNS).getValues();
    publishedSheet.getRange(1, 1, 1, TOTAL_COLUMNS).setValues(headerValues);

    Logger.log('publishedシートを新規作成しました');
  }

  return publishedSheet;
}

/**
 * publishedシートにデータ行を追加する
 * @param publishedSheet publishedシート
 * @param data 元データ配列
 * @param rowIndices 追加する行のインデックス（0始まり）
 */
function appendRowsToPublishedSheet(
  publishedSheet: GoogleAppsScript.Spreadsheet.Sheet,
  data: unknown[][],
  rowIndices: number[]
): void {
  const lastRow = publishedSheet.getLastRow();
  const rowsToAppend = rowIndices.map((i) => data[i]);

  // 一括書き込み
  publishedSheet
    .getRange(lastRow + 1, 1, rowsToAppend.length, TOTAL_COLUMNS)
    .setValues(rowsToAppend);
}

/**
 * 元シートから指定行を削除する
 * 行番号のずれを防ぐため、下から上に向かって削除する
 * @param sourceSheet 元シート
 * @param rowIndices 削除する行のインデックス（0始まり、data配列内のインデックス）
 */
function deleteRowsFromSource(
  sourceSheet: GoogleAppsScript.Spreadsheet.Sheet,
  rowIndices: number[]
): void {
  // 降順にソート（下から削除するため）
  const sortedIndices = [...rowIndices].sort((a, b) => b - a);

  for (const index of sortedIndices) {
    // data配列のインデックスからスプレッドシートの実際の行番号に変換
    const actualRow = index + DATA_START_ROW;
    sourceSheet.deleteRow(actualRow);
  }
}
