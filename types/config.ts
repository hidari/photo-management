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

  /** アーカイブ作成に使用するコマンド（デフォルト: 'rip'） */
  archiveTool?: string;
}
