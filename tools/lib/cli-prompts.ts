/**
 * CLIプロンプトライブラリ
 *
 * コマンドラインでのユーザーインタラクション機能を提供する
 */

/**
 * ユーザーに確認プロンプトを表示する
 *
 * @param message - 表示するメッセージ
 * @returns ユーザーが'y'を入力した場合true
 */
export async function promptConfirm(message: string): Promise<boolean> {
  console.log(message);
  const buf = new Uint8Array(1024);
  const n = await Deno.stdin.read(buf);

  if (n === null) {
    return false;
  }

  const input = new TextDecoder().decode(buf.subarray(0, n)).trim().toLowerCase();
  return input === 'y' || input === 'yes';
}
