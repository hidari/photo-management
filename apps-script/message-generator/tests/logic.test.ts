/**
 * message-generatorのロジック関数のテスト
 */

import { assertEquals } from 'jsr:@std/assert';

// テスト対象の関数を再定義（GASコードから抽出）
// 本来はsrc/から直接インポートしたいが、GAS環境とDeno環境の互換性のため、
// ここでは関数を複製している

/**
 * スプレッドシート行データの型定義
 */
interface RowData {
  id: string;
  file: string;
  photoTitle: string;
  title: string;
  character: string;
  modelName: string;
  modelAccount: string;
  optionalEventHashtags: string;
  ready: boolean;
}

/**
 * 行データの必須項目をバリデーションする
 */
function validateRow(rowData: RowData): boolean {
  return !!(
    (
      rowData.id &&
      rowData.file &&
      rowData.photoTitle &&
      rowData.title &&
      rowData.character &&
      rowData.modelName &&
      rowData.modelAccount
    )
    // OPTIONAL_EVENT_HASHTAGSは必須ではない
  );
}

/**
 * テンプレート内の変数を実際のデータで置換する
 */
function replaceTemplateVariables(template: string, data: RowData): string {
  let message = template;

  // 変数置換マッピング
  const replacements: Record<string, string> = {
    PHOTO_TITLE: data.photoTitle,
    TITLE: data.title,
    CHARACTER: data.character,
    MODEL_NAME: data.modelName,
    MODEL_ACCOUNT: data.modelAccount,
    OPTIONAL_EVENT_HASHTAGS: data.optionalEventHashtags,
  };

  // 各変数を置換
  for (const [key, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`\\$\\{${key}\\}`, 'g');
    message = message.replace(pattern, value);
  }

  return message;
}

/**
 * OPTIONAL_EVENT_HASHTAGSが空の場合、"At. "で始まる行全体を削除する
 */
function removeEmptyHashtagLine(message: string): string {
  // "At." で始まり、その後が空白のみの行とその改行を削除
  // [ \t]* は改行を除くスペース・タブのみにマッチ
  return message.replace(/^At\.[ \t]*\n/gm, '');
}

/**
 * リンクURLが既に設定済みかどうかを判定する
 */
function isAlreadyLinked(linkUrl: string | null): boolean {
  return linkUrl !== null && linkUrl !== '';
}

// ==================== テスト ====================

Deno.test('validateRow - すべての必須項目が入力されている場合はtrue', () => {
  const rowData: RowData = {
    id: '001',
    file: 'photo.jpg',
    photoTitle: '夏の思い出',
    title: '夏フェス2024',
    character: '浴衣',
    modelName: '山田花子',
    modelAccount: '@hanako',
    optionalEventHashtags: '#夏フェス',
    ready: true,
  };

  const result = validateRow(rowData);

  assertEquals(result, true);
});

Deno.test('validateRow - OPTIONAL_EVENT_HASHTAGSが空でもtrue', () => {
  const rowData: RowData = {
    id: '001',
    file: 'photo.jpg',
    photoTitle: '夏の思い出',
    title: '夏フェス2024',
    character: '浴衣',
    modelName: '山田花子',
    modelAccount: '@hanako',
    optionalEventHashtags: '', // オプション項目
    ready: true,
  };

  const result = validateRow(rowData);

  assertEquals(result, true);
});

Deno.test('validateRow - IDが空の場合はfalse', () => {
  const rowData: RowData = {
    id: '',
    file: 'photo.jpg',
    photoTitle: '夏の思い出',
    title: '夏フェス2024',
    character: '浴衣',
    modelName: '山田花子',
    modelAccount: '@hanako',
    optionalEventHashtags: '#夏フェス',
    ready: true,
  };

  const result = validateRow(rowData);

  assertEquals(result, false);
});

Deno.test('validateRow - MODEL_NAMEが空の場合はfalse', () => {
  const rowData: RowData = {
    id: '001',
    file: 'photo.jpg',
    photoTitle: '夏の思い出',
    title: '夏フェス2024',
    character: '浴衣',
    modelName: '',
    modelAccount: '@hanako',
    optionalEventHashtags: '#夏フェス',
    ready: true,
  };

  const result = validateRow(rowData);

  assertEquals(result, false);
});

Deno.test('validateRow - 複数の必須項目が空の場合はfalse', () => {
  const rowData: RowData = {
    id: '',
    file: '',
    photoTitle: '',
    title: '夏フェス2024',
    character: '浴衣',
    modelName: '山田花子',
    modelAccount: '@hanako',
    optionalEventHashtags: '#夏フェス',
    ready: true,
  };

  const result = validateRow(rowData);

  assertEquals(result, false);
});

Deno.test('replaceTemplateVariables - すべての変数が正しく置換される', () => {
  const template =
    '${PHOTO_TITLE}\n${TITLE}\n${CHARACTER}\nModel: ${MODEL_NAME} (${MODEL_ACCOUNT})\n${OPTIONAL_EVENT_HASHTAGS}';
  const data: RowData = {
    id: '001',
    file: 'photo.jpg',
    photoTitle: '夏の思い出',
    title: '夏フェス2024',
    character: '浴衣',
    modelName: '山田花子',
    modelAccount: '@hanako',
    optionalEventHashtags: '#夏フェス #浴衣',
    ready: true,
  };

  const result = replaceTemplateVariables(template, data);

  assertEquals(
    result,
    '夏の思い出\n夏フェス2024\n浴衣\nModel: 山田花子 (@hanako)\n#夏フェス #浴衣'
  );
});

Deno.test('replaceTemplateVariables - 同じ変数が複数回出現する場合', () => {
  const template = '${TITLE} - ${TITLE} - ${TITLE}';
  const data: RowData = {
    id: '001',
    file: 'photo.jpg',
    photoTitle: '夏の思い出',
    title: '夏フェス2024',
    character: '浴衣',
    modelName: '山田花子',
    modelAccount: '@hanako',
    optionalEventHashtags: '',
    ready: true,
  };

  const result = replaceTemplateVariables(template, data);

  assertEquals(result, '夏フェス2024 - 夏フェス2024 - 夏フェス2024');
});

Deno.test('replaceTemplateVariables - 空文字列の変数も正しく置換される', () => {
  const template = 'Title: ${TITLE}\nHashtags: ${OPTIONAL_EVENT_HASHTAGS}';
  const data: RowData = {
    id: '001',
    file: 'photo.jpg',
    photoTitle: '夏の思い出',
    title: '夏フェス2024',
    character: '浴衣',
    modelName: '山田花子',
    modelAccount: '@hanako',
    optionalEventHashtags: '',
    ready: true,
  };

  const result = replaceTemplateVariables(template, data);

  assertEquals(result, 'Title: 夏フェス2024\nHashtags: ');
});

Deno.test('removeEmptyHashtagLine - At.で始まる空行が削除される', () => {
  const message = 'タイトル\n説明文\nAt. \n#ハッシュタグ';

  const result = removeEmptyHashtagLine(message);

  // "At. \n"が削除され、改行が1つになる
  assertEquals(result, 'タイトル\n説明文\n#ハッシュタグ');
});

Deno.test('removeEmptyHashtagLine - At.のみの行が削除される', () => {
  const message = 'タイトル\nAt.\n説明文';

  const result = removeEmptyHashtagLine(message);

  assertEquals(result, 'タイトル\n説明文');
});

Deno.test('removeEmptyHashtagLine - At.で始まるが後ろに文字がある行は削除されない', () => {
  const message = 'タイトル\nAt. イベント会場\n説明文';

  const result = removeEmptyHashtagLine(message);

  assertEquals(result, 'タイトル\nAt. イベント会場\n説明文');
});

Deno.test('removeEmptyHashtagLine - 複数のAt.空行が削除される', () => {
  const message = 'タイトル\nAt. \nAt. \n説明文';

  const result = removeEmptyHashtagLine(message);

  assertEquals(result, 'タイトル\n説明文');
});

Deno.test('removeEmptyHashtagLine - At.がない場合はそのまま', () => {
  const message = 'タイトル\n説明文\n#ハッシュタグ';

  const result = removeEmptyHashtagLine(message);

  assertEquals(result, 'タイトル\n説明文\n#ハッシュタグ');
});

// ==================== isAlreadyLinked テスト ====================

Deno.test('isAlreadyLinked - リンクURLがnullの場合はfalse', () => {
  assertEquals(isAlreadyLinked(null), false);
});

Deno.test('isAlreadyLinked - リンクURLが空文字の場合はfalse', () => {
  assertEquals(isAlreadyLinked(''), false);
});

Deno.test('isAlreadyLinked - リンクURLがある場合はtrue', () => {
  assertEquals(isAlreadyLinked('https://drive.google.com/file/d/xxx'), true);
});
