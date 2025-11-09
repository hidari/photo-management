/**
 * ripバイナリ自動セットアップユーティリティ
 *
 * このライブラリは、GitHub Releasesからripバイナリをダウンロードしてセットアップします
 */

import { ensureDir } from 'https://deno.land/std@0.208.0/fs/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import { decompress } from 'https://deno.land/x/zip@v1.2.5/mod.ts';
import { Project, SyntaxKind } from 'npm:ts-morph@27.0.0';
import type { PlatformInfo } from '../../types/binary-setup.ts';

/**
 * GitHub Release情報
 */
interface GitHubRelease {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

/**
 * 実行プラットフォームを検出する
 *
 * @returns プラットフォーム情報
 */
export function detectPlatform(): PlatformInfo {
  const os = Deno.build.os;
  const arch = Deno.build.arch;

  if (os === 'darwin' && arch === 'aarch64') {
    return {
      os: 'darwin',
      arch: 'aarch64',
      zipName: 'rip-zip-aarch64-apple-darwin.zip',
      binaryName: 'rip',
    };
  }

  if (os === 'linux' && arch === 'x86_64') {
    return {
      os: 'linux',
      arch: 'x86_64',
      zipName: 'rip-zip-x86_64-unknown-linux-gnu.zip',
      binaryName: 'rip',
    };
  }

  if (os === 'windows' && arch === 'x86_64') {
    return {
      os: 'windows',
      arch: 'x86_64',
      zipName: 'rip-zip-x86_64-pc-windows-msvc.zip',
      binaryName: 'rip.exe',
    };
  }

  throw new Error(`サポートされていないプラットフォームです: ${os}-${arch}`);
}

/**
 * バイナリの配置パスを取得する
 *
 * @returns バイナリのフルパス
 */
export function getBinaryPath(): string {
  const homeDir = Deno.env.get('HOME') || Deno.env.get('USERPROFILE');
  if (!homeDir) {
    throw new Error('ホームディレクトリが見つかりません');
  }

  const platform = detectPlatform();
  const binDir = join(homeDir, '.config', 'photo-management', 'bin');
  return join(binDir, platform.binaryName);
}

/**
 * GitHub Releasesから最新バージョン情報を取得する
 *
 * @returns 最新リリース情報
 */
export async function getLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch('https://api.github.com/repos/hidari/rip-zip/releases/latest');

  if (!response.ok) {
    throw new Error(`GitHub APIエラー: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * ダウンロードURLを構築する
 *
 * @param release - GitHub Release情報
 * @param zipName - ダウンロードするzipファイル名
 * @returns ダウンロードURL
 */
export function buildDownloadUrl(release: GitHubRelease, zipName: string): string {
  const asset = release.assets.find((a) => a.name === zipName);

  if (!asset) {
    throw new Error(`指定されたアセットが見つかりません: ${zipName}`);
  }

  return asset.browser_download_url;
}

/**
 * zipファイルをダウンロードして解凍する
 *
 * @param url - ダウンロードURL
 * @param destPath - 配置先パス
 */
export async function downloadAndExtract(url: string, destPath: string): Promise<void> {
  const platform = detectPlatform();

  console.log(`ダウンロード中: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ダウンロードエラー: ${response.status} ${response.statusText}`);
  }

  const zipData = new Uint8Array(await response.arrayBuffer());

  // 一時ディレクトリに保存
  const tempDir = await Deno.makeTempDir();
  const tempZipPath = join(tempDir, 'rip.zip');

  await Deno.writeFile(tempZipPath, zipData);

  console.log(`解凍中...`);

  // decompressを使用してクロスプラットフォーム対応の解凍を実行
  try {
    await decompress(tempZipPath, tempDir);
  } catch (error) {
    throw new Error(
      `zipファイルの解凍に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // バイナリファイルを探す
  const binaryPath = join(tempDir, platform.binaryName);

  try {
    await Deno.stat(binaryPath);
  } catch {
    throw new Error(`バイナリファイルが見つかりません: ${platform.binaryName}`);
  }

  // 配置先ディレクトリを作成
  const destDir = join(destPath, '..');
  await ensureDir(destDir);

  // バイナリを配置
  await Deno.copyFile(binaryPath, destPath);

  // 実行権限を付与（Unix系のみ）
  if (platform.os !== 'windows') {
    await Deno.chmod(destPath, 0o755);
  }

  // 一時ディレクトリを削除
  await Deno.remove(tempDir, { recursive: true });

  console.log(`✅ バイナリを配置しました: ${destPath}`);
}

/**
 * バイナリが正常に実行できるかテストする
 *
 * @param binaryPath - テストするバイナリのパス
 * @returns 実行可能な場合true
 */
export async function testBinary(binaryPath: string): Promise<boolean> {
  try {
    const process = new Deno.Command(binaryPath, {
      args: ['--version'],
      stdout: 'piped',
      stderr: 'piped',
    });

    const { success } = await process.output();
    return success;
  } catch {
    return false;
  }
}

/**
 * config.tsを更新してarchiveToolフィールドを設定する
 *
 * @param binaryPath - 設定するバイナリのパス
 */
export async function updateConfigFile(binaryPath: string): Promise<void> {
  console.log(`config.ts を更新中...`);

  const project = new Project();
  const configFile = project.addSourceFileAtPath('./config.ts');

  // config変数を取得
  const configVariable = configFile.getVariableDeclarationOrThrow('config');
  const initializer = configVariable.getInitializerIfKindOrThrow(
    SyntaxKind.ObjectLiteralExpression
  );

  // archiveToolプロパティを探す
  const archiveToolProp = initializer.getProperty('archiveTool');

  if (archiveToolProp) {
    // 既存の場合は値を更新
    const propAssignment = archiveToolProp.asKind(SyntaxKind.PropertyAssignment);
    if (propAssignment) {
      propAssignment.setInitializer(`'${binaryPath}'`);
      console.log(`   ✅ archiveTool を更新しました`);
    }
  } else {
    // 存在しない場合は追加（developedDirectoryBaseの後）
    const devDirProp = initializer.getPropertyOrThrow('developedDirectoryBase');
    const index = devDirProp.getChildIndex() + 1;

    initializer.insertPropertyAssignment(index, {
      name: 'archiveTool',
      initializer: `'${binaryPath}'`,
    });

    console.log(`   ✅ archiveTool を追加しました`);
  }

  // ファイルを保存
  await configFile.save();
}

/**
 * ripバイナリをセットアップする（メイン関数）
 *
 * @returns セットアップされたバイナリのパス
 */
export async function ensureRipBinary(): Promise<string> {
  const binaryPath = getBinaryPath();

  // 既存のバイナリをチェック
  try {
    await Deno.stat(binaryPath);
    const isWorking = await testBinary(binaryPath);

    if (isWorking) {
      console.log(`✅ ripバイナリは既にセットアップされています: ${binaryPath}`);
      return binaryPath;
    }

    console.log(`⚠️  既存のバイナリが正常に動作しません。再ダウンロードします...`);
  } catch {
    // ファイルが存在しない場合は続行
    console.log(`ripバイナリが見つかりません。自動セットアップを開始します...`);
  }

  // 最新リリースを取得
  console.log(`最新バージョンを確認中...`);
  const release = await getLatestRelease();
  console.log(`   最新バージョン: ${release.tag_name}`);

  // プラットフォームを検出
  const platform = detectPlatform();
  console.log(`   プラットフォーム: ${platform.os}-${platform.arch}`);

  // ダウンロードURLを構築
  const downloadUrl = buildDownloadUrl(release, platform.zipName);

  // ダウンロード・解凍
  await downloadAndExtract(downloadUrl, binaryPath);

  // 実行テスト
  const isWorking = await testBinary(binaryPath);

  if (!isWorking) {
    throw new Error('バイナリのセットアップに失敗しました');
  }

  // config.tsを更新
  await updateConfigFile(binaryPath);

  console.log();
  console.log(`✅ ripバイナリのセットアップが完了しました`);
  console.log(`   パス: ${binaryPath}`);

  return binaryPath;
}
