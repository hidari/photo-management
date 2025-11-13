/**
 * SNS投稿メッセージ生成スクリプト
 *
 * スプレッドシートにバインドされたGoogle Apps Scriptで、
 * READY=TRUEの行に対してテンプレートからメッセージを生成し、
 * MESSAGE列に書き戻す機能を提供します。
 */

/**
 * 列定義（Google Apps Scriptは1始まり）
 */
const COLUMNS = {
  ID: 1, // A列
  FILE: 2, // B列
  PHOTO_TITLE: 3, // C列
  TITLE: 4, // D列
  CHARACTER: 5, // E列
  MODEL_NAME: 6, // F列
  MODEL_ACCOUNT: 7, // G列
  OPTIONAL_EVENT_HASHTAGS: 8, // H列
  READY: 9, // I列
  MESSAGE: 10, // J列
  PUBLISHED: 11, // K列
} as const;

/**
 * スプレッドシート行データの型定義
 */
interface RowData {
  id: string;
  file: string;
  photoTitle: string;
  title: string;
  character: string;
  modelName: string;
  modelAccount: string;
  optionalEventHashtags: string;
  ready: boolean;
}

/**
 * スプレッドシート起動時に自動実行される関数
 * カスタムメニューを追加します（スマートフォンからも実行可能）
 */
// biome-ignore lint/correctness/noUnusedVariables: GAS環境でグローバル関数として使用される
function onOpen(): void {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📝 メッセージ生成').addItem('メッセージを生成する', 'generateMessages').addToUi();
}

/**
 * メイン処理：READY=TRUEの行に対してメッセージを生成し、MESSAGE列に書き戻す
 */
// biome-ignore lint/correctness/noUnusedVariables: GAS環境でグローバル関数として使用される
function generateMessages(): void {
  try {
    // スプレッドシートを取得
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lastRow = sheet.getLastRow();

    // ヘッダー行のみの場合は終了
    if (lastRow <= 1) {
      Browser.msgBox('データが存在しません。');
      return;
    }

    // テンプレートを取得
    const template = getTemplateContent();

    // 全データを取得（ヘッダー行を除く）
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 11);
    const data = dataRange.getValues();

    let processedCount = 0;

    // 各行を処理
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowIndex = i + 2; // 実際の行番号（ヘッダー分+1、配列index分+1）

      // READY列がTRUEかチェック
      const readyValue = row[COLUMNS.READY - 1];
      if (readyValue !== true && readyValue !== 'TRUE') {
        continue;
      }

      // PUBLISHED列がTRUEの場合はスキップ（既に投稿済み）
      const publishedValue = row[COLUMNS.PUBLISHED - 1];
      if (publishedValue === true || publishedValue === 'TRUE') {
        Logger.log(
          `行 ${rowIndex}: 既に投稿済みのためスキップしました（ID: ${row[COLUMNS.ID - 1]}）`
        );
        continue;
      }

      // MESSAGE列に値がある場合はスキップ（既に生成済み）
      const messageValue = String(row[COLUMNS.MESSAGE - 1] || '').trim();
      if (messageValue !== '') {
        Logger.log(
          `行 ${rowIndex}: 既にメッセージが生成済みのためスキップしました（ID: ${row[COLUMNS.ID - 1]}）`
        );
        continue;
      }

      // 行データをオブジェクトに変換
      const rowData: RowData = {
        id: String(row[COLUMNS.ID - 1] || '').trim(),
        file: String(row[COLUMNS.FILE - 1] || '').trim(),
        photoTitle: String(row[COLUMNS.PHOTO_TITLE - 1] || '').trim(),
        title: String(row[COLUMNS.TITLE - 1] || '').trim(),
        character: String(row[COLUMNS.CHARACTER - 1] || '').trim(),
        modelName: String(row[COLUMNS.MODEL_NAME - 1] || '').trim(),
        modelAccount: String(row[COLUMNS.MODEL_ACCOUNT - 1] || '').trim(),
        optionalEventHashtags: String(row[COLUMNS.OPTIONAL_EVENT_HASHTAGS - 1] || '').trim(),
        ready: true,
      };

      // 必須項目のバリデーション
      if (!validateRow(rowData)) {
        Logger.log(`行 ${rowIndex}: 必須項目が未入力のためスキップしました（ID: ${rowData.id}）`);
        continue;
      }

      // メッセージ生成
      let message = replaceTemplateVariables(template, rowData);
      message = removeEmptyHashtagLine(message);

      // MESSAGE列に書き込み
      sheet.getRange(rowIndex, COLUMNS.MESSAGE).setValue(message);
      processedCount++;
    }

    // 完了メッセージ
    Browser.msgBox(`${processedCount}件のメッセージを生成しました。`);
  } catch (error) {
    Browser.msgBox(
      `エラーが発生しました:\n${error instanceof Error ? error.message : String(error)}`
    );
    Logger.log(error);
  }
}

/**
 * Google DriveからPOST.txtテンプレートを読み込む
 * @returns テンプレート文字列
 * @throws ファイルIDが未設定またはファイルが見つからない場合
 */
function getTemplateContent(): string {
  const properties = PropertiesService.getScriptProperties();
  const fileId = properties.getProperty('POST_TEMPLATE_FILE_ID');

  if (!fileId) {
    throw new Error(
      'POST.txtのファイルIDが設定されていません。\n\n' +
        'スクリプトプロパティに「POST_TEMPLATE_FILE_ID」を設定してください。\n' +
        '設定方法：GASエディタ → プロジェクトの設定 → スクリプト プロパティ'
    );
  }

  try {
    const file = DriveApp.getFileById(fileId);
    return file.getBlob().getDataAsString('UTF-8');
  } catch (_error) {
    throw new Error(
      `POST.txtファイルを読み込めませんでした（ファイルID: ${fileId}）\n\n` +
        'ファイルが存在するか、アクセス権限があるか確認してください。'
    );
  }
}

/**
 * 行データの必須項目をバリデーションする
 * @param rowData 行データ
 * @returns すべての必須項目が入力されている場合true
 */
function validateRow(rowData: RowData): boolean {
  return !!(
    (
      rowData.id &&
      rowData.file &&
      rowData.photoTitle &&
      rowData.title &&
      rowData.character &&
      rowData.modelName &&
      rowData.modelAccount
    )
    // OPTIONAL_EVENT_HASHTAGSは必須ではない
  );
}

/**
 * テンプレート内の変数を実際のデータで置換する
 * @param template テンプレート文字列
 * @param data 行データ
 * @returns 変数が置換されたメッセージ
 */
function replaceTemplateVariables(template: string, data: RowData): string {
  let message = template;

  // 変数置換マッピング
  const replacements: Record<string, string> = {
    PHOTO_TITLE: data.photoTitle,
    TITLE: data.title,
    CHARACTER: data.character,
    MODEL_NAME: data.modelName,
    MODEL_ACCOUNT: data.modelAccount,
    OPTIONAL_EVENT_HASHTAGS: data.optionalEventHashtags,
  };

  // 各変数を置換
  for (const [key, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`\\$\\{${key}\\}`, 'g');
    message = message.replace(pattern, value);
  }

  return message;
}

/**
 * OPTIONAL_EVENT_HASHTAGSが空の場合、"At. "で始まる行全体を削除する
 * @param message メッセージ文字列
 * @returns 処理後のメッセージ
 */
function removeEmptyHashtagLine(message: string): string {
  // "At." で始まり、その後が空白のみの行を削除（改行含む）
  return message.replace(/^At\.\s*$\n?/gm, '').replace(/\n{3,}/g, '\n\n');
}

/**
 * セル編集時に自動実行される関数（Simple Trigger）
 * READY列のチェック時とデータ列編集時に検証を行う
 * @param e イベントオブジェクト
 */
// biome-ignore lint/correctness/noUnusedVariables: GAS環境でグローバル関数として使用される
function onEdit(e: GoogleAppsScript.Events.SheetsOnEdit): void {
  try {
    const sheet = e.source.getActiveSheet();
    const range = e.range;
    const row = range.getRow();
    const col = range.getColumn();

    // ヘッダー行は無視
    if (row <= 1) {
      return;
    }

    // I列（READY列）が編集された場合
    if (col === COLUMNS.READY) {
      handleReadyColumnEdit(sheet, row);
      return;
    }

    // A～H列（データ列）が編集された場合
    if (col >= COLUMNS.ID && col <= COLUMNS.OPTIONAL_EVENT_HASHTAGS) {
      handleDataColumnEdit(sheet, row);
      return;
    }
  } catch (error) {
    // onEditトリガーではBrowser.msgBoxが使えないため、Loggerに記録
    Logger.log(`onEditエラー: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * READY列がチェックされたときの処理
 * 必須項目が揃っていない場合はチェックを外してアラート表示
 * @param sheet スプレッドシート
 * @param row 行番号
 */
function handleReadyColumnEdit(sheet: GoogleAppsScript.Spreadsheet.Sheet, row: number): void {
  const readyCell = sheet.getRange(row, COLUMNS.READY);
  const isChecked = readyCell.getValue();

  // チェックが入れられた場合のみ検証
  if (isChecked !== true && isChecked !== 'TRUE') {
    return;
  }

  // 必須項目を検証
  const emptyColumns = getEmptyRequiredColumns(sheet, row);

  if (emptyColumns.length > 0) {
    // チェックを外す
    readyCell.setValue(false);

    // アラート表示
    const columnNames = emptyColumns.join('、');
    SpreadsheetApp.getUi().alert(
      'READYチェック不可',
      `必須項目が入力されていないため、READYにチェックを入れることができません。\n\n` +
        `未入力の項目: ${columnNames}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * データ列（A～H列）が編集されたときの処理
 * READY列がチェック済みの場合、再検証してチェックを外す
 * @param sheet スプレッドシート
 * @param row 行番号
 */
function handleDataColumnEdit(sheet: GoogleAppsScript.Spreadsheet.Sheet, row: number): void {
  const readyCell = sheet.getRange(row, COLUMNS.READY);
  const isChecked = readyCell.getValue();

  // READY列がチェックされていない場合は何もしない
  if (isChecked !== true && isChecked !== 'TRUE') {
    return;
  }

  // 必須項目を検証
  const emptyColumns = getEmptyRequiredColumns(sheet, row);

  // 必須項目が揃っていない場合はチェックを外す（サイレント）
  if (emptyColumns.length > 0) {
    readyCell.setValue(false);
  }
}

/**
 * 指定行の空の必須項目を取得する
 * @param sheet スプレッドシート
 * @param row 行番号
 * @returns 空の必須項目の列名配列
 */
function getEmptyRequiredColumns(sheet: GoogleAppsScript.Spreadsheet.Sheet, row: number): string[] {
  const emptyColumns: string[] = [];

  // 必須項目の定義（列番号と列名のマッピング）
  const requiredColumns: Array<{ col: number; name: string }> = [
    { col: COLUMNS.ID, name: 'ID（A列）' },
    { col: COLUMNS.FILE, name: 'FILE（B列）' },
    { col: COLUMNS.PHOTO_TITLE, name: 'PHOTO_TITLE（C列）' },
    { col: COLUMNS.TITLE, name: 'TITLE（D列）' },
    { col: COLUMNS.CHARACTER, name: 'CHARACTER（E列）' },
    { col: COLUMNS.MODEL_NAME, name: 'MODEL_NAME（F列）' },
    { col: COLUMNS.MODEL_ACCOUNT, name: 'MODEL_ACCOUNT（G列）' },
  ];

  // 各必須項目をチェック
  for (const { col, name } of requiredColumns) {
    const value = String(sheet.getRange(row, col).getValue() || '').trim();
    if (value === '') {
      emptyColumns.push(name);
    }
  }

  return emptyColumns;
}
