/**
 * Google Drive上の古いイベントフォルダ自動削除スクリプト(Google Apps Script版)
 *
 * このスクリプトは、Google Apps Scriptのトリガー機能を使って
 * 指定した日数より古いイベントフォルダを定期的に削除する
 *
 * セットアップ手順:
 * 1. プロジェクトのconfig.tsに必要な設定を記述
 * 2. `pnpm run gas:deploy` でデプロイ（clasp push + 設定値の自動転送）
 * 3. Google Apps Scriptエディタで「トリガー」メニューから時間主導型トリガーを設定（例: 毎日午前2時）
 * 4. 初回実行時にGoogle Driveへのアクセス権限を承認
 *
 * 注意:
 * - このスクリプトは完全自動で動作します
 * - 削除前の確認プロンプトはありません
 * - 実行ログはGoogleスプレッドシートに記録されます
 * - 設定値はPropertiesServiceで管理されます（コード内にハードコードしません）
 */

// ==================== 設定管理 ====================

/**
 * PropertiesServiceから設定値を読み込む
 * 設定値はpnpm run gas:setupコマンドで事前に登録されている必要がある
 */
function loadConfig(): {
  photoDistributionFolderId: string;
  retentionDays: number;
  notificationEmail: string;
  logSpreadsheetId: string;
} {
  const props = PropertiesService.getUserProperties();

  const photoDistributionFolderId = props.getProperty('PHOTO_DISTRIBUTION_FOLDER_ID');
  const retentionDaysStr = props.getProperty('RETENTION_DAYS');
  const notificationEmail = props.getProperty('NOTIFICATION_EMAIL');
  const logSpreadsheetId = props.getProperty('LOG_SPREADSHEET_ID');

  // 必須設定のバリデーション
  if (!photoDistributionFolderId) {
    throw new Error(
      '設定エラー: PHOTO_DISTRIBUTION_FOLDER_IDが設定されていません。\n' +
        'pnpm run gas:setup を実行して設定を登録してください。'
    );
  }

  if (!retentionDaysStr) {
    throw new Error(
      '設定エラー: RETENTION_DAYSが設定されていません。\n' +
        'pnpm run gas:setup を実行して設定を登録してください。'
    );
  }

  if (!notificationEmail) {
    throw new Error(
      '設定エラー: NOTIFICATION_EMAILが設定されていません。\n' +
        'pnpm run gas:setup を実行して設定を登録してください。'
    );
  }

  const retentionDays = Number.parseInt(retentionDaysStr, 10);
  if (Number.isNaN(retentionDays) || retentionDays <= 0) {
    throw new Error(`設定エラー: RETENTION_DAYSが無効な値です: ${retentionDaysStr}`);
  }

  return {
    photoDistributionFolderId,
    retentionDays,
    notificationEmail,
    logSpreadsheetId: logSpreadsheetId || '',
  };
}

/**
 * ログ記録用スプレッドシートを自動作成する
 * LOG_SPREADSHEET_IDが未設定の場合、新しいスプレッドシートを作成してIDを保存する
 *
 * @returns {string} スプレッドシートID
 */
function ensureLogSpreadsheet(): string {
  const props = PropertiesService.getUserProperties();
  let logSpreadsheetId = props.getProperty('LOG_SPREADSHEET_ID');

  if (!logSpreadsheetId) {
    // 新規スプレッドシートを作成
    const spreadsheet = SpreadsheetApp.create('写真配布フォルダ削除ログ');
    const sheet = spreadsheet.getActiveSheet();
    sheet.setName('CleanupLog');
    sheet.appendRow(['実行日時', '削除数', '削除フォルダ', 'エラー数']);

    logSpreadsheetId = spreadsheet.getId();
    props.setProperty('LOG_SPREADSHEET_ID', logSpreadsheetId);

    Logger.log(`新しいログスプレッドシートを作成しました: ${spreadsheet.getUrl()}`);
  }

  return logSpreadsheetId;
}

// ==================== メイン処理 ====================

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
 *
 * @param now - 現在日時
 * @param createdTime - 作成日時
 * @returns 経過日数（整数）
 */
function calculateDaysOld(now: Date, createdTime: Date): number {
  return Math.floor((now.getTime() - createdTime.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 指定した日数より古いフォルダを抽出する
 *
 * @param folders - フォルダ情報配列
 * @param retentionDays - 保持期間(日数)
 * @returns 削除対象のフォルダ配列
 */
function filterOldFolders(folders: EventFolderInfo[], retentionDays: number): EventFolderInfo[] {
  return folders.filter((folder) => folder.daysOld > retentionDays);
}

/**
 * PhotoDistribution内のイベントフォルダを一覧取得する
 *
 * @param {string} folderId - PhotoDistributionフォルダのID
 * @returns {EventFolderInfo[]} イベントフォルダの情報配列
 */
function listEventFolders(folderId: string): EventFolderInfo[] {
  const parentFolder = DriveApp.getFolderById(folderId);
  const folders = parentFolder.getFolders();
  const now = new Date();
  const result: EventFolderInfo[] = [];

  while (folders.hasNext()) {
    const folder = folders.next();
    const createdTime = folder.getDateCreated();
    const daysOld = calculateDaysOld(now, new Date(createdTime.getTime()));

    result.push(
      new EventFolderInfo(
        folder.getId(),
        folder.getName(),
        new Date(createdTime.getTime()),
        daysOld
      )
    );
  }

  return result;
}

/**
 * フォルダを削除する
 *
 * @param {EventFolderInfo} folderInfo - フォルダ情報
 * @returns {boolean} 成功した場合true
 */
function deleteFolder(folderInfo: EventFolderInfo): boolean {
  try {
    const folder = DriveApp.getFolderById(folderInfo.id);
    folder.setTrashed(true);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.log(`フォルダの削除に失敗: ${folderInfo.name} - ${errorMessage}`);
    return false;
  }
}

/**
 * 実行ログをスプレッドシートに記録する
 *
 * @param {string} logSpreadsheetId - ログスプレッドシートのID
 * @param {Date} executionTime - 実行日時
 * @param {number} deletedCount - 削除されたフォルダ数
 * @param {EventFolderInfo[]} deletedFolders - 削除されたフォルダ
 * @param {number} errorCount - エラー数
 */
function logToSpreadsheet(
  logSpreadsheetId: string,
  executionTime: Date,
  deletedCount: number,
  deletedFolders: EventFolderInfo[],
  errorCount: number
): void {
  if (!logSpreadsheetId) {
    return;
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(logSpreadsheetId);
    let sheet = spreadsheet.getSheetByName('CleanupLog');

    // シートが存在しない場合は作成
    if (!sheet) {
      sheet = spreadsheet.insertSheet('CleanupLog');
      sheet.appendRow(['実行日時', '削除数', '削除フォルダ', 'エラー数']);
    }

    const folderNames = deletedFolders.map((f: EventFolderInfo) => f.name).join(', ');
    sheet.appendRow([
      Utilities.formatDate(executionTime, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      deletedCount,
      folderNames || '(なし)',
      errorCount,
    ]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.log(`ログ記録に失敗: ${errorMessage}`);
  }
}

/**
 * メール通知を送信する
 *
 * @param {string} notificationEmail - 通知先メールアドレス
 * @param {number} retentionDays - 保持期間(日数)
 * @param {Date} executionTime - 実行日時
 * @param {number} deletedCount - 削除されたフォルダ数
 * @param {EventFolderInfo[]} deletedFolders - 削除されたフォルダ
 * @param {number} errorCount - エラー数
 */
function sendNotification(
  notificationEmail: string,
  retentionDays: number,
  executionTime: Date,
  deletedCount: number,
  deletedFolders: EventFolderInfo[],
  errorCount: number
): void {
  if (!notificationEmail) {
    return;
  }

  const subject = `[写真配布] 古いイベントフォルダの削除完了 (${deletedCount}件)`;

  let body = '写真配布用フォルダの自動削除が実行されました。\n\n';
  body += `実行日時: ${Utilities.formatDate(executionTime, Session.getScriptTimeZone(), 'yyyy年MM月dd日 HH:mm')}\n`;
  body += `保持期間: ${retentionDays}日\n`;
  body += `削除数: ${deletedCount}件\n`;
  body += `エラー: ${errorCount}件\n\n`;

  if (deletedCount > 0) {
    body += '削除されたフォルダ:\n';
    for (const folder of deletedFolders) {
      body += `  • ${folder.name}\n`;
      body += `    作成日: ${Utilities.formatDate(folder.createdTime, Session.getScriptTimeZone(), 'yyyy-MM-dd')}\n`;
      body += `    経過日数: ${folder.daysOld}日\n\n`;
    }
  } else {
    body += '削除対象のフォルダはありませんでした。\n';
  }

  if (errorCount > 0) {
    body += '\n⚠️ 一部のフォルダの削除に失敗しました。\n';
    body += 'Google Apps Scriptのログを確認してください。\n';
  }

  body += '\n---\n';
  body += 'このメールは自動送信されました。\n';

  try {
    MailApp.sendEmail(notificationEmail, subject, body);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.log(`メール送信に失敗: ${errorMessage}`);
  }
}

/**
 * メイン関数（トリガーから呼び出される）
 */

// biome-ignore lint/correctness/noUnusedVariables: トリガーから呼び出される想定なので未使用でも大丈夫
function cleanupOldEvents() {
  const executionTime = new Date();

  try {
    // 設定を読み込む
    const config = loadConfig();

    Logger.log('========================================');
    Logger.log(`実行開始: ${executionTime}`);
    Logger.log(`保持期間: ${config.retentionDays}日`);
    Logger.log('========================================');

    // ログスプレッドシートが未設定の場合は自動作成
    const logSpreadsheetId = ensureLogSpreadsheet();

    // イベントフォルダを一覧取得
    const allFolders = listEventFolders(config.photoDistributionFolderId);
    Logger.log(`イベントフォルダ数: ${allFolders.length}`);

    // 古いフォルダを抽出
    const oldFolders = filterOldFolders(allFolders, config.retentionDays);
    Logger.log(`削除対象: ${oldFolders.length}件`);

    if (oldFolders.length === 0) {
      Logger.log('削除対象のフォルダはありません');
      logToSpreadsheet(logSpreadsheetId, executionTime, 0, [], 0);
      sendNotification(config.notificationEmail, config.retentionDays, executionTime, 0, [], 0);
      return;
    }

    // フォルダを削除
    const deletedFolders = [];
    let errorCount = 0;

    for (const folder of oldFolders) {
      Logger.log(`削除中: ${folder.name} (${folder.daysOld}日経過)`);

      if (deleteFolder(folder)) {
        deletedFolders.push(folder);
      } else {
        errorCount++;
      }
    }

    Logger.log(`削除完了: ${deletedFolders.length}件`);
    Logger.log(`エラー: ${errorCount}件`);

    // ログ記録とメール通知
    logToSpreadsheet(
      logSpreadsheetId,
      executionTime,
      deletedFolders.length,
      deletedFolders,
      errorCount
    );
    sendNotification(
      config.notificationEmail,
      config.retentionDays,
      executionTime,
      deletedFolders.length,
      deletedFolders,
      errorCount
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.log(`エラー: ${errorMessage}`);

    // エラー通知（設定が読み込めなかった場合は通知不可）
    try {
      const config = loadConfig();
      if (config.notificationEmail) {
        MailApp.sendEmail(
          config.notificationEmail,
          '[写真配布] フォルダ削除でエラーが発生',
          `自動削除処理でエラーが発生しました。\n\n` +
            `実行日時: ${Utilities.formatDate(executionTime, Session.getScriptTimeZone(), 'yyyy年MM月dd日 HH:mm')}\n` +
            `エラー: ${errorMessage}\n\n` +
            `Google Apps Scriptのログを確認してください。`
        );
      }
    } catch {
      // 設定読み込みに失敗した場合は通知を送信できない
      Logger.log('設定読み込みに失敗したため、エラー通知を送信できませんでした');
    }
  }

  Logger.log('========================================');
}

/**
 * セットアップ確認用の関数（手動実行用）
 * 削除は実行せず、削除対象のみを表示します
 */

// biome-ignore lint/correctness/noUnusedVariables: 手動実行でテストが必要な場合に使うので大丈夫
function testCleanup() {
  try {
    // 設定を読み込む
    const config = loadConfig();

    Logger.log('========================================');
    Logger.log('テストモード: 削除は実行しません');
    Logger.log(`保持期間: ${config.retentionDays}日`);
    Logger.log('========================================');

    const allFolders = listEventFolders(config.photoDistributionFolderId);
    Logger.log(`イベントフォルダ数: ${allFolders.length}`);

    const oldFolders = filterOldFolders(allFolders, config.retentionDays);
    Logger.log(`削除対象: ${oldFolders.length}件`);

    if (oldFolders.length === 0) {
      Logger.log('削除対象のフォルダはありません');
      return;
    }

    Logger.log('\n削除対象のフォルダ:');
    for (const folder of oldFolders) {
      Logger.log(`  • ${folder.name}`);
      Logger.log(`    作成日: ${folder.createdTime}`);
      Logger.log(`    経過日数: ${folder.daysOld}日`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.log(`エラー: ${errorMessage}`);
  }

  Logger.log('========================================');
}
