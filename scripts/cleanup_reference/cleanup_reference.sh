#!/bin/bash

# RAWフォルダから削除されたデータに対応するReferenceJPEGを削除するスクリプト
#
# 使い方:
#   ./cleanup-reference-jpeg.sh /path/to/_RAW/撮影データ
#   ./cleanup-reference-jpeg.sh /path/to/_RAW/撮影データ --delete
#
# 引数なし or --dry-run: 削除対象の一覧表示のみ
# --delete: 実際に削除する

set -euo pipefail

export LANG=C.UTF-8
export LC_ALL=C.UTF-8

SHOOTING_DIR="${1:?撮影データフォルダのパスを指定してください}"
MODE="${2:---dry-run}"

RAW_DIR="${SHOOTING_DIR}/RAW"
JPEG_DIR="${SHOOTING_DIR}/.ReferenceJPEG"

# フォルダの存在チェック
if [[ ! -d "$RAW_DIR" ]]; then
  echo "エラー: RAWフォルダが見つかりません: $RAW_DIR" >&2
  exit 1
fi

if [[ ! -d "$JPEG_DIR" ]]; then
  echo "エラー: ReferenceJPEGフォルダが見つかりません: $JPEG_DIR" >&2
  exit 1
fi

# RAWフォルダのファイル名（拡張子なし）を一時ファイルに収集
raw_names_file="$(mktemp)"
trap 'rm -f "$raw_names_file"' EXIT
find "$RAW_DIR" -maxdepth 1 -type f -print0 | while IFS= read -r -d '' file; do
  basename "${file%.*}"
done > "$raw_names_file"

# ReferenceJPEGフォルダを走査して、対応RAWがないものを検出
count=0
delete_count=0

while IFS= read -r -d '' jpeg; do
  name="$(basename "${jpeg%.*}")"
  count=$((count + 1))

  if ! grep -qxF "$name" "$raw_names_file"; then
    delete_count=$((delete_count + 1))

    if [[ "$MODE" == "--delete" ]]; then
      echo "削除: $(basename "$jpeg")"
      rm "$jpeg"
    else
      echo "削除対象: $(basename "$jpeg")"
    fi
  fi
done < <(find "$JPEG_DIR" -maxdepth 1 -type f -print0)

echo ""
echo "--- 結果 ---"
echo ".ReferenceJPEG内のファイル数: $count"
echo "対応RAWなし: $delete_count"

if [[ "$MODE" != "--delete" && $delete_count -gt 0 ]]; then
  echo ""
  echo "※ dry-runモードです。実際に削除するには --delete を付けて実行してください。"
fi