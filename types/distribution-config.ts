/**
 * イベント用ディレクトリ構造作成機能の型定義
 */

/**
 * モデルの情報
 */
export interface EventModel {
  /** モデル名 */
  name: string;

  /** 初めての撮影かどうか (true: 初回, false: 2回目以降) */
  outreach: boolean;

  /** SNSアカウントのURL */
  sns?: string;

  /** Google Driveのダウンロード用共有URL */
  download_url?: string;

  /** モデルへの配布メッセージ */
  message?: string;

  /** XのDMインテントURL */
  intent_url?: string;

  /** XのユーザーID（再アップロード時のスクレイピング回数削減用） */
  recipient_id?: string;

  /** 配布済みフラグ (true: 配布済み, false/未設定: 未配布) */
  distributed?: boolean;
}

/**
 * イベントの情報
 */
export interface Event {
  /** イベント日付 (YYYYMMDD形式) */
  date: string;

  /** イベント名 */
  event_name: string;

  /** 参加モデルのリスト */
  models: EventModel[];
}

/**
 * TOMLファイル全体の構造
 */
export interface DistributionConfig {
  /** イベントのリスト */
  events: Event[];
}

/**
 * ディレクトリ構造の情報
 */
export interface DirectoryStructure {
  /** ベースディレクトリ */
  baseDir: string;

  /** イベントディレクトリ名 */
  eventDir: string;

  /** モデルごとのディレクトリ情報 */
  models: ModelDirectory[];
}

/**
 * モデルごとのディレクトリ情報
 */
export interface ModelDirectory {
  /** モデル名 */
  modelName: string;

  /** 配布用ディレクトリのパス */
  distDir: string;

  /** README.txtの出力先パス */
  readmePath: string;
}
