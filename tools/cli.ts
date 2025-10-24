/**
 * 写真管理ツール CLI
 *
 * 対話的なメニューシステムで各種ツールを実行
 */

/**
 * 画面をクリアする
 */
function clearScreen(): void {
  console.clear();
}

/**
 * タイトルバナーを表示
 */
function displayBanner(): void {
  console.log('========================================');
  console.log('     写真管理ツール');
  console.log('========================================');
  console.log();
}

/**
 * 標準入力から1行読み取る
 */
function readLine(message: string): string {
  const input = prompt(message);

  if (input === null) {
    Deno.exit(0);
  }

  return input.trim();
}

/**
 * Enterキーで続行
 */
function waitForEnter(): void {
  readLine('\nEnterキーで続行...');
}

/**
 * コマンドを実行する
 */
async function runCommand(command: string[]): Promise<boolean> {
  console.log(`\n実行中: ${command.join(' ')}\n`);

  const process = new Deno.Command(command[0], {
    args: command.slice(1),
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { success } = await process.output();

  if (!success) {
    console.error('\n⚠ コマンドの実行に失敗しました');
    return false;
  }

  console.log('\n✓ 完了しました');
  return true;
}

/**
 * メニュー項目の型定義
 */
interface MenuItem {
  key: string;
  label: string;
  description: string;
  command: string[];
}

/**
 * メニュー項目の定義
 */
const menuItems: MenuItem[] = [
  {
    key: '1',
    label: 'イベント初期化',
    description: '新しいイベントの設定ファイルを作成します',
    command: ['deno', 'task', 'init'],
  },
  {
    key: '2',
    label: 'README生成',
    description: '配布用READMEファイルを生成します',
    command: ['deno', 'task', 'readme'],
  },
  {
    key: '3',
    label: 'ディレクトリ作成',
    description: 'モデルごとの配布ディレクトリを作成します',
    command: ['deno', 'task', 'dirs'],
  },
  {
    key: '4',
    label: 'アーカイブ作成',
    description: '配布ディレクトリをZIPファイルにアーカイブします',
    command: ['deno', 'task', 'archive'],
  },
  {
    key: '5',
    label: 'アップロード',
    description: 'アーカイブをGoogle Cloud Storageにアップロードします',
    command: ['deno', 'task', 'upload'],
  },
  {
    key: '6',
    label: '配布ドキュメント作成',
    description: '配布用の最終ドキュメントを生成します',
    command: ['deno', 'task', 'distribution'],
  },
  {
    key: '7',
    label: 'Intent URL生成',
    description: 'LINE配信用のIntent URLを生成します',
    command: ['deno', 'task', 'intent'],
  },
  {
    key: '8',
    label: '配布一括実行',
    description: 'アーカイブ→アップロード→配布→Intent URLを一括実行します',
    command: ['deno', 'task', 'ship'],
  },
];

/**
 * メニューを表示
 */
function displayMenu(): void {
  clearScreen();
  displayBanner();

  console.log('操作を選択してください:\n');

  for (const item of menuItems) {
    console.log(`[${item.key}] ${item.label}`);
    console.log(`    ${item.description}\n`);
  }

  console.log('[q] 終了\n');
}

/**
 * メインループ
 */
async function main(): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    displayMenu();

    const choice = readLine('選択 (1-8, q):').toLowerCase();

    // 終了
    if (choice === 'q' || choice === 'quit' || choice === 'exit') {
      console.log('\n終了します。');
      break;
    }

    // メニュー項目を検索
    const selectedItem = menuItems.find((item) => item.key === choice);

    if (!selectedItem) {
      console.log('\n⚠ 無効な選択です');
      waitForEnter();
      continue;
    }

    // コマンド実行
    clearScreen();
    displayBanner();
    console.log(`▶ ${selectedItem.label}`);
    console.log(`  ${selectedItem.description}\n`);

    await runCommand(selectedItem.command);
    waitForEnter();
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
