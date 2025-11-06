/**
 * ブラウザ環境セットアップライブラリ
 *
 * Puppeteerなどのブラウザ自動化ツールの環境準備機能を提供する
 */

import { exists } from 'https://deno.land/std@0.208.0/fs/mod.ts';

/**
 * Puppeteerが必要とするChromeがインストールされているかチェックし、
 * なければ自動でダウンロードする関数
 */
export async function ensureChrome(): Promise<void> {
  const homedir = Deno.env.get('HOME') || Deno.env.get('USERPROFILE');
  const cacheDir = `${homedir}/.cache/puppeteer`;

  console.log('   関連ツールのインストール状況を確認中...');

  const cacheExists = await exists(cacheDir);

  if (!cacheExists) {
    console.log('   関連ツールが見つかりません。ダウンロードを開始します...');

    const command = new Deno.Command('deno', {
      args: [
        'run',
        '-A',
        'npm:@puppeteer/browsers',
        'install',
        'chrome@stable',
        '--path',
        cacheDir,
      ],
      stdout: 'inherit',
      stderr: 'inherit',
    });

    const { code } = await command.output();

    if (code !== 0) {
      throw new Error(`関連ツールのインストールに失敗しました（終了コード: ${code}）`);
    }

    console.log('   ✓ 関連ツールのダウンロードが完了しました！');
  } else {
    console.log('   ✓ 既にインストールされています');
  }
}
