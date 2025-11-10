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
 * @param configFilePath - config.tsのパス（省略時はデフォルトパスを使用）
 * @returns 更新が成功した場合true
 */
export async function updateConfigField(
  fieldName: string,
  value: string,
  configFilePath?: string
): Promise<boolean> {
  try {
    const filePath = configFilePath ?? CONFIG_FILE_PATH;
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

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
 * @param configFilePath - config.tsのパス（省略時はデフォルトパスを使用）
 * @returns すべての更新が成功した場合true
 */
export async function updateConfigFields(
  updates: Record<string, string>,
  configFilePath?: string
): Promise<boolean> {
  try {
    const filePath = configFilePath ?? CONFIG_FILE_PATH;
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

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
 * config.tsのcontactsフィールドを更新する
 *
 * @param contacts - 連絡先オブジェクトの配列（例: [{ X: '@username' }, { Email: 'email@example.com' }]）
 * @param configFilePath - config.tsのパス（省略時はデフォルトパスを使用）
 * @returns 更新が成功した場合true
 */
export async function updateContactsField(
  contacts: Array<Record<string, string>>,
  configFilePath?: string
): Promise<boolean> {
  try {
    const filePath = configFilePath ?? CONFIG_FILE_PATH;
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    // configオブジェクトを探す
    const configVar = sourceFile.getVariableDeclaration('config');
    if (!configVar) {
      throw new Error('config.tsにconfigオブジェクトが見つかりません');
    }

    const configObj = configVar.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
    if (!configObj) {
      throw new Error('configオブジェクトの初期化子が不正です');
    }

    // contactsプロパティを取得
    const property = configObj.getProperty('contacts');

    // 配列リテラルを構築
    // JSON.stringify を使用して安全にエンコード
    const arrayElements = contacts.map((contact) => {
      const entries = Object.entries(contact);
      const props = entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ');
      return `{ ${props} }`;
    });
    const arrayLiteral = `[${arrayElements.join(', ')}]`;

    if (property?.isKind(SyntaxKind.PropertyAssignment)) {
      // 既存プロパティを更新
      const propAssignment = property as PropertyAssignment;
      propAssignment.setInitializer(arrayLiteral);
      console.log('  ✏️  contacts を更新しました');
    } else {
      // 新規プロパティを追加
      configObj.addPropertyAssignment({
        name: 'contacts',
        initializer: arrayLiteral,
      });
      console.log('  ➕ contacts を新規追加しました');
    }

    // ファイルに書き込み
    await sourceFile.save();
    return true;
  } catch (error) {
    console.error(
      `❌ contactsの更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * config.tsから指定フィールドの値を読み取る
 *
 * @param fieldName - 読み取るフィールド名
 * @param configFilePath - config.tsのパス（省略時はデフォルトパスを使用）
 * @returns フィールドの値（文字列）。見つからない場合はundefined
 */
export function readConfigField(fieldName: string, configFilePath?: string): string | undefined {
  try {
    const filePath = configFilePath ?? CONFIG_FILE_PATH;
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

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
