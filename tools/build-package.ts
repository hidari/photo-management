/**
 * 配布用ZIPパッケージビルドスクリプト
 *
 * 開発環境ごと配布するためのZIPファイルを作成します
 */

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
 * ファイルを一時ディレクトリにコピー
 */
async function copyFile(src: string, dest: string): Promise<void> {
  await Deno.copyFile(src, dest);
}

/**
 * ディレクトリを再帰的にコピー
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await Deno.mkdir(dest, { recursive: true });

  for await (const entry of Deno.readDir(src)) {
    const srcPath = `${src}/${entry.name}`;
    const destPath = `${dest}/${entry.name}`;

    if (entry.isDirectory) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

/**
 * 配布に必要なファイルを一時ディレクトリにコピー
 */
async function copyDistributionFiles(tempDir: string): Promise<void> {
  console.log('▶ 配布ファイルをコピー中...');

  // config.example.tsのコピー
  await copyFile('config.example.ts', `${tempDir}/config.example.ts`);

  // deno.jsonのコピー（build-packageタスクを除外）
  const denoConfig = JSON.parse(await Deno.readTextFile('deno.json'));
  if (denoConfig.tasks?.['build-package']) {
    delete denoConfig.tasks['build-package'];
  }
  await Deno.writeTextFile(`${tempDir}/deno.json`, JSON.stringify(denoConfig, null, 2));

  // distribution.config.example.tomlのコピー
  await copyFile('distribution.config.example.toml', `${tempDir}/distribution.config.example.toml`);

  // READMEをコピー（DISTRIBUTION_README.txt → README.txt）
  await copyFile('templates/DISTRIBUTION_README.txt', `${tempDir}/README.txt`);

  // toolsディレクトリ（build-package.tsは除外）
  await Deno.mkdir(`${tempDir}/tools`, { recursive: true });
  for await (const entry of Deno.readDir('tools')) {
    if (entry.name !== 'build-package.ts') {
      const srcPath = `tools/${entry.name}`;
      const destPath = `${tempDir}/tools/${entry.name}`;
      if (entry.isDirectory) {
        await copyDir(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  }

  // typesディレクトリのコピー
  await copyDir('types', `${tempDir}/types`);

  // docsディレクトリのコピー
  await copyDir('docs', `${tempDir}/docs`);

  // templatesディレクトリ（DISTRIBUTION_README.txtは除外）
  await Deno.mkdir(`${tempDir}/templates`, { recursive: true });
  for await (const entry of Deno.readDir('templates')) {
    if (entry.name !== 'DISTRIBUTION_README.txt') {
      const srcPath = `templates/${entry.name}`;
      const destPath = `${tempDir}/templates/${entry.name}`;
      if (entry.isDirectory) {
        await copyDir(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  }

  console.log('✓ ファイルのコピーが完了しました\n');
}

/**
 * ZIPアーカイブを作成
 */
async function createZip(sourceDir: string, zipName: string): Promise<boolean> {
  console.log(`📦 ${zipName} を作成中...`);

  // sourceDirから'dist/'プレフィックスを削除してディレクトリ名だけを取得
  const dirName = sourceDir.replace(/^dist\//, '');

  // zipコマンドを使用
  // distディレクトリ内で実行することでZIP内に'dist/'が含まれないようにする
  const command = new Deno.Command('zip', {
    args: ['-r', zipName, dirName],
    stdout: 'piped',
    stderr: 'piped',
    cwd: 'dist',
  });

  const { success, stderr } = await command.output();

  if (!success) {
    console.error('✗ ZIPの作成に失敗しました');
    console.error(new TextDecoder().decode(stderr));
    return false;
  }

  console.log(`✓ ${zipName} を作成しました\n`);
  return true;
}

/**
 * ビルド情報ファイルを作成
 */
async function createBuildInfo(version: string, zipName: string): Promise<void> {
  const buildInfo = {
    version,
    buildDate: new Date().toISOString(),
    zipFile: zipName,
    description: '開発環境を含む配布パッケージ',
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
  const packageName = `photo-management-v${version}`;
  const tempDir = `dist/${packageName}`;
  const zipName = `${packageName}.zip`;

  console.log('========================================');
  console.log(`  配布パッケージビルド v${version}`);
  console.log('========================================\n');

  try {
    // distディレクトリの作成
    await ensureDistDir();

    // 一時ディレクトリを作成
    await Deno.mkdir(tempDir, { recursive: true });

    // 配布ファイルをコピー
    await copyDistributionFiles(tempDir);

    // ZIP作成
    const zipSuccess = await createZip(tempDir, zipName);
    if (!zipSuccess) {
      await cleanupTempDir(tempDir);
      Deno.exit(1);
    }

    // ビルド情報の保存
    await createBuildInfo(version, zipName);

    // 一時ディレクトリをクリーンアップ
    await cleanupTempDir(tempDir);

    // 結果サマリー
    console.log('========================================');
    console.log('  ビルド完了');
    console.log('========================================\n');
    console.log('✓ 配布パッケージが正常に作成されました');
    console.log(`\n配布パッケージ: dist/${zipName}`);
  } catch (error) {
    console.error('✗ ビルドに失敗しました:', error);
    await cleanupTempDir(tempDir);
    Deno.exit(1);
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
