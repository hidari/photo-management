/**
 * バイナリセットアップ機能の型定義
 */

/**
 * プラットフォーム情報
 */
export interface PlatformInfo {
  /** オペレーティングシステム (darwin, linux, windows) */
  os: string;
  /** CPUアーキテクチャ (aarch64, x86_64) */
  arch: string;
  /** ダウンロード対象のzipファイル名 */
  zipName: string;
  /** プラットフォーム固有のバイナリファイル名 */
  binaryName: string;
}
