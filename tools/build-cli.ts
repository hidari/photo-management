/**
 * CLIツールのクロスプラットフォームビルドスクリプト
 *
 * Windows、macOS（Intel/Apple Silicon）、Linux用の実行ファイルを生成し、ZIP形式で配布パッケージを作成
 */

interface BuildTarget {
  name: string;
  target: string;
  platform: string;
  executable: string;
}

const APP_NAME = 'photo-manager';

/**
 * Gitタグからバージョン情報を取得
 *
 * 出力例:
 * - v1.0.0 → 1.0.0 (リリース版)
 * - v1.0.0-3-g1234abc → 1.0.0-dev.3+g1234abc (開発版)
 * - タグなし → 0.0.0-dev (初期開発)
 */
async function getVersionFromGit(): Promise<string> {
  try {
    const command = new Deno.Command('git', {
      args: ['describe', '--tags', '--always', '--dirty=-modified'],
      stdout: 'piped',
      stderr: 'piped',
    });

    const { success, stdout } = await command.output();

    if (!success) {
      console.warn('⚠ Gitタグが見つかりません。開発版バージョンを使用します。');
      return '0.0.0-dev';
    }

    let version = new TextDecoder().decode(stdout).trim();

    // vプレフィックスを削除: v1.0.0 → 1.0.0
    version = version.replace(/^v/, '');

    // セマンティックバージョニング準拠に変換
    // 1.0.0-3-g1234abc → 1.0.0-dev.3+g1234abc
    version = version.replace(/-(\d+)-g([a-f0-9]+)/, '-dev.$1+g$2');

    // -dirty → -modified
    version = version.replace(/-dirty$/, '-modified');

    return version;
  } catch (error) {
    console.error('⚠ Gitコマンドの実行に失敗しました:', error);
    return '0.0.0-dev';
  }
}

const targets: BuildTarget[] = [
  {
    name: 'Windows (x86_64)',
    target: 'x86_64-pc-windows-msvc',
    platform: 'windows-x64',
    executable: 'photo-manager.exe',
  },
  {
    name: 'macOS (Intel)',
    target: 'x86_64-apple-darwin',
    platform: 'macos-x64',
    executable: 'photo-manager',
  },
  {
    name: 'macOS (Apple Silicon)',
    target: 'aarch64-apple-darwin',
    platform: 'macos-arm64',
    executable: 'photo-manager',
  },
  {
    name: 'Linux (x86_64)',
    target: 'x86_64-unknown-linux-gnu',
    platform: 'linux-x64',
    executable: 'photo-manager',
  },
];

/**
 * distディレクトリを作成
 */
async function ensureDistDir(): Promise<void> {
  try {
    await Deno.mkdir('dist', { recursive: true });
    console.log('✓ dist/ ディレクトリを作成しました\n');
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

/**
 * 一時ビルドディレクトリをクリーンアップ
 */
async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await Deno.remove(tempDir, { recursive: true });
  } catch {
    // エラーは無視
  }
}

/**
 * ビルドを実行
 */
async function build(target: BuildTarget, _version: string, tempDir: string): Promise<boolean> {
  console.log(`▶ ${target.name} をビルド中...`);

  const outputPath = `${tempDir}/${target.executable}`;

  const command = new Deno.Command('deno', {
    args: [
      'compile',
      '--allow-read',
      '--allow-write',
      '--allow-run',
      '--allow-env',
      '--allow-net',
      '--allow-sys',
      '--target',
      target.target,
      '--output',
      outputPath,
      'tools/cli.ts',
    ],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { success, stderr } = await command.output();

  if (!success) {
    console.error(`✗ ${target.name} のビルドに失敗しました`);
    console.error(new TextDecoder().decode(stderr));
    return false;
  }

  // Unix系は実行権限を設定
  if (target.executable !== 'photo-manager.exe') {
    try {
      await Deno.chmod(outputPath, 0o755);
      console.log(`  ✓ 実行権限を設定しました (755)`);
    } catch (error) {
      console.error(`  ⚠ 実行権限の設定に失敗しました:`, error);
    }
  }

  console.log(`✓ ${target.name} のビルドが完了しました\n`);
  return true;
}

/**
 * 配布用READMEをコピー
 */
async function copyReadme(destDir: string): Promise<void> {
  const readmePath = 'templates/DISTRIBUTION_README.txt';
  const destPath = `${destDir}/README.txt`;

  try {
    await Deno.copyFile(readmePath, destPath);
  } catch (error) {
    console.error(`⚠ READMEのコピーに失敗しました:`, error);
    throw error;
  }
}

/**
 * ZIPアーカイブを作成
 */
async function createZip(sourceDir: string, zipName: string): Promise<boolean> {
  console.log(`📦 ${zipName} を作成中...`);

  // sourceDirから'dist/'プレフィックスを削除してディレクトリ名だけを取得
  const dirName = sourceDir.replace(/^dist\//, '');

  // zipコマンドを使用（実行権限を保持）
  // distディレクトリ内で実行することでZIP内に'dist/'が含まれないようにする
  const command = new Deno.Command('zip', {
    args: ['-r', zipName, dirName],
    stdout: 'piped',
    stderr: 'piped',
    cwd: 'dist',
  });

  const { success, stderr } = await command.output();

  if (!success) {
    console.error(`✗ ZIPの作成に失敗しました`);
    console.error(new TextDecoder().decode(stderr));
    return false;
  }

  console.log(`✓ ${zipName} を作成しました\n`);
  return true;
}

/**
 * パッケージを作成
 */
async function createPackage(target: BuildTarget, version: string): Promise<boolean> {
  const dirName = `${APP_NAME}-v${version}-${target.platform}`;
  const tempDir = `dist/${dirName}`;
  const zipName = `${dirName}.zip`;

  try {
    // ディレクトリ作成
    await Deno.mkdir(tempDir, { recursive: true });

    // ビルド
    const buildSuccess = await build(target, version, tempDir);
    if (!buildSuccess) {
      await cleanupTempDir(tempDir);
      return false;
    }

    // READMEをコピー
    await copyReadme(tempDir);

    // ZIP作成
    const zipSuccess = await createZip(tempDir, zipName);
    if (!zipSuccess) {
      await cleanupTempDir(tempDir);
      return false;
    }

    // 一時ディレクトリをクリーンアップ
    await cleanupTempDir(tempDir);

    return true;
  } catch (error) {
    console.error(`✗ ${target.name} のパッケージ作成に失敗しました:`, error);
    await cleanupTempDir(tempDir);
    return false;
  }
}

/**
 * ビルド情報ファイルを作成
 */
async function createBuildInfo(version: string): Promise<void> {
  const buildInfo = {
    version,
    buildDate: new Date().toISOString(),
    targets: targets.map((t) => ({
      name: t.name,
      target: t.target,
      platform: t.platform,
      zipFile: `${APP_NAME}-v${version}-${t.platform}.zip`,
    })),
  };

  await Deno.writeTextFile('dist/build-info.json', JSON.stringify(buildInfo, null, 2));
  console.log('✓ ビルド情報を dist/build-info.json に保存しました\n');
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  // Gitタグからバージョン取得
  const version = await getVersionFromGit();

  console.log('========================================');
  console.log(`  ${APP_NAME} v${version} ビルド`);
  console.log('========================================\n');

  // distディレクトリの作成
  await ensureDistDir();

  // 各プラットフォーム向けにパッケージ作成
  let successCount = 0;
  let failCount = 0;

  for (const target of targets) {
    const success = await createPackage(target, version);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  // ビルド情報の保存
  await createBuildInfo(version);

  // 結果サマリー
  console.log('========================================');
  console.log('  ビルド完了');
  console.log('========================================\n');
  console.log(`成功: ${successCount}/${targets.length}`);

  if (failCount > 0) {
    console.log(`失敗: ${failCount}/${targets.length}`);
    console.log('\n⚠ 一部のビルドが失敗しました');
    Deno.exit(1);
  }

  console.log('\n✓ すべてのビルドが正常に完了しました');
  console.log('\n配布パッケージ:');
  for (const target of targets) {
    const zipName = `${APP_NAME}-v${version}-${target.platform}.zip`;
    console.log(`  - dist/${zipName}`);
  }
}

// スクリプト実行
if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\nエラー: ${error.message}`);
    } else {
      console.error('\n予期しないエラーが発生しました');
    }
    Deno.exit(1);
  }
}
