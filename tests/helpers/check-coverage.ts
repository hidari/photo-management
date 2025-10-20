#!/usr/bin/env deno run --allow-read --allow-run

/**
 * カバレッジ閾値チェックスクリプト
 *
 * カバレッジが指定された閾値を下回っている場合はエラーで終了します。
 *
 * 使い方:
 *   deno run --allow-read --allow-run tools/check-coverage.ts [threshold]
 *
 * 引数:
 *   threshold - カバレッジの最小閾値（デフォルト: 80）
 */

const DEFAULT_THRESHOLD = 50;

/**
 * カバレッジレポートを生成してサマリーを表示
 */
async function displayCoverage(): Promise<void> {
  const command = new Deno.Command('deno', {
    args: ['coverage', 'coverage/'],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { code } = await command.output();
  if (code !== 0) {
    throw new Error('カバレッジレポートの生成に失敗しました');
  }
}

/**
 * カバレッジ率を取得
 */
async function getCoveragePercentage(): Promise<number> {
  const command = new Deno.Command('deno', {
    args: ['coverage', 'coverage/'],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout } = await command.output();
  if (code !== 0) {
    throw new Error('カバレッジ情報の取得に失敗しました');
  }

  const output = new TextDecoder().decode(stdout);

  // ANSI色コードを削除
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI色コードを削除するため制御文字が必要
  const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');

  // "All files" の行からLine %を抽出
  // フォーマット: | All files | XX.X | YY.Y |
  const match = cleanOutput.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (!match) {
    // デバッグ用に出力を表示
    console.error('カバレッジ出力（ANSI削除後）:');
    console.error(cleanOutput);
    throw new Error('カバレッジ率を解析できませんでした');
  }

  // Line % (2番目の数値) を返す
  return Number.parseFloat(match[2]);
}

/**
 * メイン処理
 */
async function main() {
  const threshold = Deno.args[0] ? Number.parseFloat(Deno.args[0]) : DEFAULT_THRESHOLD;

  if (Number.isNaN(threshold) || threshold < 0 || threshold > 100) {
    console.error('❌ エラー: 閾値は0〜100の数値を指定してください');
    Deno.exit(1);
  }

  console.log(`\n📊 カバレッジレポート (閾値: ${threshold}%)\n`);

  // カバレッジレポートを表示
  await displayCoverage();

  console.log();

  // カバレッジ率を取得
  const coverage = await getCoveragePercentage();

  console.log(`\n📈 総合カバレッジ: ${coverage.toFixed(1)}%`);
  console.log(`🎯 設定閾値: ${threshold}%\n`);

  // 閾値チェック
  if (coverage < threshold) {
    console.error(`❌ カバレッジ ${coverage.toFixed(1)}% が閾値 ${threshold}% を下回っています`);
    Deno.exit(1);
  }

  console.log(`✅ カバレッジ ${coverage.toFixed(1)}% は閾値 ${threshold}% を満たしています`);
}

if (import.meta.main) {
  main();
}
