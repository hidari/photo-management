/**
 * 連絡先の型定義
 * プラットフォーム名をキーとして、ハンドル名を値とするオブジェクト
 */
export interface Contact {
  [platform: string]: string;
}

/**
 * 設定全体の型定義
 * この型を定義しておくことで、設定の構造が明確になり、
 * 他のファイルから使うときに型チェックが効く
 */
export interface Config {
  /** 管理者名（撮影者名） */
  administrator: string;

  /** 連絡先のリスト */
  contacts: Contact[];

  /** 現像済み画像の保存先ベースディレクトリ */
  developedDirectoryBase: string;

  /** アーカイブ作成ツールのフルパス（未設定時は初回実行時に自動セットアップ） */
  archiveTool?: string;

  /** Google Drive OAuth 2.0 設定（アップロード機能を使用しない場合は省略可能） */
  googleDrive?: {
    /**
     * OAuth 2.0 クライアントID
     * デスクトップアプリケーション型のクライアントIDを指定
     * Google Cloud Console で作成したクライアントIDを使用
     */
    clientId: string;

    /**
     * OAuth 2.0 クライアントシークレット
     * デスクトップアプリケーション型の場合、公開されても安全な設計
     */
    clientSecret: string;
  };

  /**
   * 配布フォルダの保持期間(日数)
   * 指定した日数より古いイベントフォルダは自動削除の対象になる
   * デフォルト: 90日
   */
  distributionRetentionDays?: number;

  /**
   * 削除通知先メールアドレス
   * Google Apps Scriptによる自動削除時に通知を送信する先
   * 未設定の場合は通知を送信しない
   */
  cleanupNotificationEmail?: string;

  /**
   * 写真配布用Google DriveフォルダのID
   * Google Apps Scriptで自動削除対象となるフォルダを指定
   * フォルダのURLから取得可能: https://drive.google.com/drive/folders/[FOLDER_ID]
   */
  photoDistributionFolderId?: string;

  /**
   * ログ記録用Google SpreadsheetのID
   * Google Apps Scriptの実行ログを記録するスプレッドシートを指定
   * 未設定の場合は初回実行時に自動作成される
   */
  logSpreadsheetId?: string;

  /**
   * SNS投稿メッセージ生成用スプレッドシートのID
   * メッセージジェネレーターがバインドされるスプレッドシートのIDを指定
   */
  messageGeneratorSpreadsheetId?: string;

  /**
   * SNS投稿メッセージテンプレートファイルのID
   * Google Drive上のPOST.txtファイルのIDを指定
   */
  postTemplateFileId?: string;
}
