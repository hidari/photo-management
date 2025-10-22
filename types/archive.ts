/**
 * アーカイブ機能の型定義
 */

/**
 * アーカイブファイルの情報
 */
export interface ArchiveInfo {
  /** モデル名 */
  modelName: string;
  /** zipファイルのパス */
  zipPath: string;
  /** イベント日付 */
  eventDate: string;
  /** イベント名 */
  eventName: string;
}
