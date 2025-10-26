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
}
