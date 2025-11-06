#!/usr/bin/env deno run --allow-read --allow-write --allow-run

/**
 * 配布実行ツール
 *
 * モデルへの配布メッセージ送信とフラグ管理
 *
 * 使い方:
 *   deno task ship                                # 最新イベントで配布実行
 *   deno task ship --config ./path/to/config.toml # 特定のtomlを指定
 *   deno task ship --force                        # 配布済みモデルも再配布
 */

import { parse } from 'https://deno.land/std@0.208.0/flags/mod.ts';
import config from '../config.ts';
import { loadTomlConfig } from './lib/config-loader.ts';
import { findTomlConfigPath } from './lib/directory-finder.ts';
import { updateModelFields } from './lib/toml-writer.ts';

/**
 * 標準入力から1行読み取る
 */
function readLine(message: string, defaultValue?: string): string {
  const displayMessage = defaultValue ? `${message} [${defaultValue}]` : message;
  const input = prompt(displayMessage);

  if (input === null) {
    Deno.exit(0);
  }

  return input.trim() || defaultValue || '';
}

/**
 * Yes/No質問
 */
function confirm(message: string, defaultValue = true): boolean {
  const defaultStr = defaultValue ? 'Y/n' : 'y/N';
  const input = readLine(`${message} (${defaultStr}):`, defaultValue ? 'y' : 'n').toLowerCase();
  return input === 'y' || input === 'yes';
}

/**
 * URLをブラウザで開く
 */
async function openUrl(url: string): Promise<void> {
  const os = Deno.build.os;

  let command: string[];
  if (os === 'darwin') {
    command = ['open', url];
  } else if (os === 'linux') {
    command = ['xdg-open', url];
  } else if (os === 'windows') {
    command = ['cmd', '/c', 'start', url];
  } else {
    throw new Error(`サポートされていないOS: ${os}`);
  }

  const process = new Deno.Command(command[0], {
    args: command.slice(1),
    stdout: 'null',
    stderr: 'null',
  });

  await process.output();
}

/**
 * メイン処理
 */
async function main() {
  const args = parse(Deno.args, {
    string: ['config'],
    boolean: ['force'],
    default: {
      force: false,
    },
  });

  console.log('🚀 配布実行ツール');
  console.log('='.repeat(50));
  console.log();

  try {
    // tomlファイルのパスを取得
    let tomlPath: string;
    if (args.config) {
      tomlPath = args.config;
      console.log(`📂 設定ファイル: ${tomlPath}`);
    } else {
      console.log('🔍 最新イベントの設定ファイルを検索しています...');
      tomlPath = await findTomlConfigPath(config);
      console.log(`✅ 見つかりました: ${tomlPath}`);
    }

    // tomlファイルを読み込み
    const distributionConfig = await loadTomlConfig(tomlPath);

    if (distributionConfig.events.length === 0) {
      console.error('❌ イベント情報が見つかりません');
      Deno.exit(1);
    }

    const event = distributionConfig.events[0];
    console.log();
    console.log(`📅 イベント: ${event.event_name} (${event.date})`);
    console.log();

    // 配布対象のモデルをフィルタリング
    const targetModels = event.models.filter((model) => {
      // intent_urlが存在しない場合は除外
      if (!model.intent_url) {
        return false;
      }

      // 配布済みで、--forceオプションがない場合は除外
      if (model.distributed && !args.force) {
        return false;
      }

      return true;
    });

    if (targetModels.length === 0) {
      console.log('📭 配布可能なモデルがいません');
      console.log();
      console.log('以下を確認してください:');
      console.log('  - deno task upload を実行して intent_url を生成済みか');
      console.log('  - すべてのモデルが配布済み（distributed=true）になっていないか');
      console.log('  - 配布済みモデルも含める場合は --force オプションを使用');
      return;
    }

    console.log(`📋 配布可能なモデル: ${targetModels.length}人`);
    console.log();

    // 配布処理のループ
    while (true) {
      // 配布対象を表示
      console.log('配布対象のモデル:');
      for (let i = 0; i < targetModels.length; i++) {
        const model = targetModels[i];
        const status = model.distributed ? '✅ 配布済み' : '⏳ 未配布';
        console.log(`  ${i + 1}. ${model.name}さん (${status})`);
      }

      console.log();
      const selection = readLine('配布するモデルの番号（数字を入力、qで終了）:');

      if (selection.toLowerCase() === 'q' || selection === '') {
        console.log('👋 配布処理を終了します');
        break;
      }

      const index = Number.parseInt(selection, 10) - 1;
      if (index < 0 || index >= targetModels.length) {
        console.error('❌ 無効な番号です');
        continue;
      }

      const selectedModel = targetModels[index];

      // メッセージプレビュー（あれば）
      if (selectedModel.message) {
        console.log();
        console.log('📧 配布メッセージプレビュー:');
        console.log('-'.repeat(50));
        console.log(selectedModel.message.substring(0, 200));
        if (selectedModel.message.length > 200) {
          console.log('... (以下省略)');
        }
        console.log('-'.repeat(50));
      }

      console.log();
      const proceed = confirm(`${selectedModel.name}さん に配布しますか?`);

      if (!proceed) {
        console.log('⏭️  スキップしました');
        console.log();
        continue;
      }

      // インテントURLを開く
      console.log();
      console.log('🌐 ブラウザで開いています...');
      if (selectedModel.intent_url) {
        await openUrl(selectedModel.intent_url);
      }

      // 配布済みフラグを更新
      console.log('💾 配布済みフラグを更新しています...');
      const updatedToml = await updateModelFields(tomlPath, selectedModel.name, {
        distributed: true,
      });
      await Deno.writeTextFile(tomlPath, updatedToml);

      console.log(`✅ ${selectedModel.name}さん への配布が完了しました`);
      console.log();

      // 次のモデルを配布するか確認
      const continueDistribution = confirm('次のモデルも配布しますか?');
      if (!continueDistribution) {
        break;
      }

      console.log();
    }

    console.log();
    console.log('🎉 配布処理が完了しました!');
  } catch (error) {
    console.error();
    if (error instanceof Error) {
      console.error(`❌ エラー: ${error.message}`);
    } else {
      console.error('❌ エラー: 予期しない問題が発生しました');
      console.error(error);
    }

    Deno.exit(1);
  }
}

// このファイルが直接実行された場合のみ、main関数を実行する
if (import.meta.main) {
  main();
}
