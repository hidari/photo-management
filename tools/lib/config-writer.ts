/**
 * config.tsを安全に編集するためのユーティリティ
 * ts-morphを使用してTypeScript ASTを操作します
 */

import { join } from 'jsr:@std/path@1';
import { Project, type PropertyAssignment, SyntaxKind } from 'npm:ts-morph@27.0.0';

const CONFIG_FILE_PATH = join(import.meta.dirname ?? '.', '..', '..', 'config.ts');

/**
 * config.tsの指定フィールドを更新する
 *
 * @param fieldName - 更新するフィールド名
 * @param value - 設定する値（文字列）
 * @returns 更新が成功した場合true
 */
export async function updateConfigField(fieldName: string, value: string): Promise<boolean> {
  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(CONFIG_FILE_PATH);

    // configオブジェクトを探す
    const configVar = sourceFile.getVariableDeclaration('config');
    if (!configVar) {
      throw new Error('config.tsにconfigオブジェクトが見つかりません');
    }

    const configObj = configVar.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
    if (!configObj) {
      throw new Error('configオブジェクトの初期化子が不正です');
    }

    // 既存プロパティを取得
    const property = configObj.getProperty(fieldName);

    if (property?.isKind(SyntaxKind.PropertyAssignment)) {
      // 既存プロパティを更新
      const propAssignment = property as PropertyAssignment;
      propAssignment.setInitializer(`'${value}'`);
      console.log(`  ✏️  ${fieldName} を更新しました`);
    } else {
      // コメントアウトされたプロパティがある場合は検出して更新
      const commentedProperty = findCommentedProperty(sourceFile, fieldName);

      if (commentedProperty) {
        // コメントアウトされた行を削除して新しいプロパティを追加
        configObj.addPropertyAssignment({
          name: fieldName,
          initializer: `'${value}'`,
        });
        console.log(`  ✏️  ${fieldName} をアンコメントして設定しました`);
      } else {
        // 新規プロパティを追加
        configObj.addPropertyAssignment({
          name: fieldName,
          initializer: `'${value}'`,
        });
        console.log(`  ➕ ${fieldName} を新規追加しました`);
      }
    }

    // ファイルに書き込み
    await sourceFile.save();
    return true;
  } catch (error) {
    console.error(
      `❌ config.tsの更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * コメントアウトされたプロパティを検出する
 *
 * @param sourceFile - ソースファイル
 * @param fieldName - 検索するフィールド名
 * @returns 見つかった場合true
 */
function findCommentedProperty(
  sourceFile: ReturnType<typeof Project.prototype.addSourceFileAtPath>,
  fieldName: string
): boolean {
  const text = sourceFile.getFullText();
  // コメントアウトされた行を検索（// fieldName: ... の形式）
  const commentedPattern = new RegExp(`^\\s*//\\s*${fieldName}\\s*:`, 'm');
  return commentedPattern.test(text);
}

/**
 * config.tsの複数フィールドを一度に更新する
 *
 * @param updates - 更新するフィールドと値のマップ
 * @returns すべての更新が成功した場合true
 */
export async function updateConfigFields(updates: Record<string, string>): Promise<boolean> {
  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(CONFIG_FILE_PATH);

    // configオブジェクトを探す
    const configVar = sourceFile.getVariableDeclaration('config');
    if (!configVar) {
      throw new Error('config.tsにconfigオブジェクトが見つかりません');
    }

    const configObj = configVar.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
    if (!configObj) {
      throw new Error('configオブジェクトの初期化子が不正です');
    }

    // 各フィールドを更新
    for (const [fieldName, value] of Object.entries(updates)) {
      const property = configObj.getProperty(fieldName);

      if (property?.isKind(SyntaxKind.PropertyAssignment)) {
        // 既存プロパティを更新
        const propAssignment = property as PropertyAssignment;
        propAssignment.setInitializer(`'${value}'`);
        console.log(`  ✏️  ${fieldName} を更新しました`);
      } else {
        // 新規プロパティを追加
        configObj.addPropertyAssignment({
          name: fieldName,
          initializer: `'${value}'`,
        });
        console.log(`  ➕ ${fieldName} を新規追加しました`);
      }
    }

    // ファイルに書き込み
    await sourceFile.save();
    return true;
  } catch (error) {
    console.error(
      `❌ config.tsの更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * config.tsから指定フィールドの値を読み取る
 *
 * @param fieldName - 読み取るフィールド名
 * @returns フィールドの値（文字列）。見つからない場合はundefined
 */
export function readConfigField(fieldName: string): string | undefined {
  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(CONFIG_FILE_PATH);

    const configVar = sourceFile.getVariableDeclaration('config');
    if (!configVar) {
      return undefined;
    }

    const configObj = configVar.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
    if (!configObj) {
      return undefined;
    }

    const property = configObj.getProperty(fieldName);
    if (property?.isKind(SyntaxKind.PropertyAssignment)) {
      const propAssignment = property as PropertyAssignment;
      const initializer = propAssignment.getInitializer();
      if (initializer) {
        // クォートを削除して返す
        const value = initializer.getText().replace(/^['"]|['"]$/g, '');
        return value;
      }
    }

    return undefined;
  } catch (error) {
    console.error(
      `❌ config.tsの読み取りに失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}
