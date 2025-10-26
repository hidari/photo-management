/**
 * Google Drive上の古いイベントフォルダ自動削除スクリプト(Google Apps Script版)
 *
 * このスクリプトは、Google Apps Scriptのトリガー機能を使って
 * 指定した日数より古いイベントフォルダを定期的に削除する
 *
 * セットアップ手順:
 * 1. Google Apps Scriptエディタで新規プロジェクトを作成
 * 2. このコードを貼り付け
 * 3. 下部の設定セクションを編集
 * 4. 「トリガー」メニューから時間主導型トリガーを設定（例: 毎日午前2時）
 * 5. 初回実行時にGoogle Driveへのアクセス権限を承認
 *
 * 注意:
 * - このスクリプトは完全自動で動作します
 * - 削除前の確認プロンプトはありません
 * - 実行ログはGoogleスプレッドシートに記録されます（オプション）
 */

// ==================== 設定 ====================

/**
 * PhotoDistributionフォルダのID
 * Google DriveでPhotoDistributionフォルダを開き、URLから取得
 * 例: https://drive.google.com/drive/folders/FOLDER_ID_HERE
 */
const PHOTO_DISTRIBUTION_FOLDER_ID = 'YOUR_FOLDER_ID_HERE';

/**
 * 保持期間(日数)
 * この日数より古いイベントフォルダは削除されます
 */
const RETENTION_DAYS = 30;

/**
 * 通知先メールアドレス
 * 削除実行後に結果を通知します
 * 空文字列の場合は通知を送信しません
 */
const NOTIFICATION_EMAIL = 'your-email@example.com';

/**
 * 実行ログを記録するスプレッドシートのID（オプション）
 * 空文字列の場合はログを記録しません
 * 新規スプレッドシートを作成し、URLからIDを取得してください
 */
const LOG_SPREADSHEET_ID = '';

// ==================== メイン処理 ====================

/**
 * イベントフォルダの情報
 */
class EventFolderInfo {
  constructor(id, name, createdTime, daysOld) {
    this.id = id;
    this.name = name;
    this.createdTime = createdTime;
    this.daysOld = daysOld;
  }
}

/**
 * PhotoDistribution内のイベントフォルダを一覧取得する
 *
 * @returns {EventFolderInfo[]} イベントフォルダの情報配列
 */
function listEventFolders() {
  const parentFolder = DriveApp.getFolderById(PHOTO_DISTRIBUTION_FOLDER_ID);
  const folders = parentFolder.getFolders();
  const now = new Date();
  const result = [];

  while (folders.hasNext()) {
    const folder = folders.next();
    const createdTime = folder.getDateCreated();
    const daysOld = Math.floor((now - createdTime) / (1000 * 60 * 60 * 24));

    result.push(new EventFolderInfo(folder.getId(), folder.getName(), createdTime, daysOld));
  }

  return result;
}

/**
 * 指定した日数より古いフォルダを抽出する
 *
 * @param {EventFolderInfo[]} folders - フォルダ情報配列
 * @param {number} retentionDays - 保持期間(日数)
 * @returns {EventFolderInfo[]} 削除対象のフォルダ配列
 */
function filterOldFolders(folders, retentionDays) {
  return folders.filter((folder) => folder.daysOld > retentionDays);
}

/**
 * フォルダを削除する
 *
 * @param {EventFolderInfo} folderInfo - フォルダ情報
 * @returns {boolean} 成功した場合true
 */
function deleteFolder(folderInfo) {
  try {
    const folder = DriveApp.getFolderById(folderInfo.id);
    folder.setTrashed(true);
    return true;
  } catch (error) {
    Logger.log(`フォルダの削除に失敗: ${folderInfo.name} - ${error.message}`);
    return false;
  }
}

/**
 * 実行ログをスプレッドシートに記録する
 *
 * @param {Date} executionTime - 実行日時
 * @param {number} deletedCount - 削除されたフォルダ数
 * @param {EventFolderInfo[]} deletedFolders - 削除されたフォルダ
 * @param {number} errorCount - エラー数
 */
function logToSpreadsheet(executionTime, deletedCount, deletedFolders, errorCount) {
  if (!LOG_SPREADSHEET_ID) {
    return;
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(LOG_SPREADSHEET_ID);
    let sheet = spreadsheet.getSheetByName('CleanupLog');

    // シートが存在しない場合は作成
    if (!sheet) {
      sheet = spreadsheet.insertSheet('CleanupLog');
      sheet.appendRow(['実行日時', '削除数', '削除フォルダ', 'エラー数']);
    }

    const folderNames = deletedFolders.map((f) => f.name).join(', ');
    sheet.appendRow([
      Utilities.formatDate(executionTime, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      deletedCount,
      folderNames || '(なし)',
      errorCount,
    ]);
  } catch (error) {
    Logger.log(`ログ記録に失敗: ${error.message}`);
  }
}

/**
 * メール通知を送信する
 *
 * @param {Date} executionTime - 実行日時
 * @param {number} deletedCount - 削除されたフォルダ数
 * @param {EventFolderInfo[]} deletedFolders - 削除されたフォルダ
 * @param {number} errorCount - エラー数
 */
function sendNotification(executionTime, deletedCount, deletedFolders, errorCount) {
  if (!NOTIFICATION_EMAIL) {
    return;
  }

  const subject = `[写真配布] 古いイベントフォルダの削除完了 (${deletedCount}件)`;

  let body = '写真配布用フォルダの自動削除が実行されました。\n\n';
  body += `実行日時: ${Utilities.formatDate(executionTime, Session.getScriptTimeZone(), 'yyyy年MM月dd日 HH:mm')}\n`;
  body += `保持期間: ${RETENTION_DAYS}日\n`;
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
    MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
  } catch (error) {
    Logger.log(`メール送信に失敗: ${error.message}`);
  }
}

/**
 * メイン関数（トリガーから呼び出される）
 */
function cleanupOldEvents() {
  const executionTime = new Date();

  Logger.log('========================================');
  Logger.log(`実行開始: ${executionTime}`);
  Logger.log(`保持期間: ${RETENTION_DAYS}日`);
  Logger.log('========================================');

  try {
    // イベントフォルダを一覧取得
    const allFolders = listEventFolders();
    Logger.log(`イベントフォルダ数: ${allFolders.length}`);

    // 古いフォルダを抽出
    const oldFolders = filterOldFolders(allFolders, RETENTION_DAYS);
    Logger.log(`削除対象: ${oldFolders.length}件`);

    if (oldFolders.length === 0) {
      Logger.log('削除対象のフォルダはありません');
      logToSpreadsheet(executionTime, 0, [], 0);
      sendNotification(executionTime, 0, [], 0);
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
    logToSpreadsheet(executionTime, deletedFolders.length, deletedFolders, errorCount);
    sendNotification(executionTime, deletedFolders.length, deletedFolders, errorCount);
  } catch (error) {
    Logger.log(`エラー: ${error.message}`);

    // エラー通知
    if (NOTIFICATION_EMAIL) {
      MailApp.sendEmail(
        NOTIFICATION_EMAIL,
        '[写真配布] フォルダ削除でエラーが発生',
        `自動削除処理でエラーが発生しました。\n\n` +
          `実行日時: ${Utilities.formatDate(executionTime, Session.getScriptTimeZone(), 'yyyy年MM月dd日 HH:mm')}\n` +
          `エラー: ${error.message}\n\n` +
          `Google Apps Scriptのログを確認してください。`
      );
    }
  }

  Logger.log('========================================');
}

/**
 * セットアップ確認用の関数（手動実行用）
 * 削除は実行せず、削除対象のみを表示します
 */
function testCleanup() {
  Logger.log('========================================');
  Logger.log('テストモード: 削除は実行しません');
  Logger.log(`保持期間: ${RETENTION_DAYS}日`);
  Logger.log('========================================');

  try {
    const allFolders = listEventFolders();
    Logger.log(`イベントフォルダ数: ${allFolders.length}`);

    const oldFolders = filterOldFolders(allFolders, RETENTION_DAYS);
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
    Logger.log(`エラー: ${error.message}`);
  }

  Logger.log('========================================');
}
