#!/usr/bin/env bats

# cleanup_reference.sh のテスト

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")" && pwd)"
SCRIPT="$SCRIPT_DIR/cleanup_reference.sh"

setup() {
  # テスト用ディレクトリ構造を作成
  TEST_DIR="$BATS_TEST_TMPDIR/shooting"
  RAW_DIR="$TEST_DIR/RAW"
  JPEG_DIR="$TEST_DIR/.ReferenceJPEG"
  mkdir -p "$RAW_DIR" "$JPEG_DIR"
}

# --- argument validation ---

@test "exits with error when no arguments given" {
  run "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "exits with error when RAW directory does not exist" {
  rm -rf "$RAW_DIR"
  run "$SCRIPT" "$TEST_DIR"
  [ "$status" -eq 1 ]
  [[ "$output" == *"RAWフォルダが見つかりません"* ]]
}

@test "exits with error when ReferenceJPEG directory does not exist" {
  rm -rf "$JPEG_DIR"
  run "$SCRIPT" "$TEST_DIR"
  [ "$status" -eq 1 ]
  [[ "$output" == *"ReferenceJPEGフォルダが見つかりません"* ]]
}

# --- dry-run mode ---

@test "dry-run: JPEG with matching RAW is not listed" {
  touch "$RAW_DIR/IMG_0001.ARW"
  touch "$JPEG_DIR/IMG_0001.JPG"

  run "$SCRIPT" "$TEST_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" == *"対応RAWなし: 0"* ]]
}

@test "dry-run: JPEG without matching RAW is listed" {
  touch "$RAW_DIR/IMG_0001.ARW"
  touch "$JPEG_DIR/IMG_0001.JPG"
  touch "$JPEG_DIR/IMG_0002.JPG"

  run "$SCRIPT" "$TEST_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" == *"削除対象: IMG_0002.JPG"* ]]
  [[ "$output" == *"対応RAWなし: 1"* ]]
}

@test "dry-run: files are not actually deleted" {
  touch "$RAW_DIR/IMG_0001.ARW"
  touch "$JPEG_DIR/IMG_0001.JPG"
  touch "$JPEG_DIR/IMG_0002.JPG"

  run "$SCRIPT" "$TEST_DIR"
  [ "$status" -eq 0 ]
  [ -f "$JPEG_DIR/IMG_0002.JPG" ]
}

@test "dry-run: shows re-run hint message" {
  touch "$JPEG_DIR/IMG_0001.JPG"

  run "$SCRIPT" "$TEST_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" == *"dry-runモードです"* ]]
}

# --- delete mode ---

@test "delete: removes JPEG without matching RAW" {
  touch "$RAW_DIR/IMG_0001.ARW"
  touch "$JPEG_DIR/IMG_0001.JPG"
  touch "$JPEG_DIR/IMG_0002.JPG"

  run "$SCRIPT" "$TEST_DIR" --delete
  [ "$status" -eq 0 ]
  [[ "$output" == *"削除: IMG_0002.JPG"* ]]
  [ -f "$JPEG_DIR/IMG_0001.JPG" ]
  [ ! -f "$JPEG_DIR/IMG_0002.JPG" ]
}

@test "delete: keeps JPEG with matching RAW" {
  touch "$RAW_DIR/IMG_0001.ARW"
  touch "$RAW_DIR/IMG_0002.ARW"
  touch "$JPEG_DIR/IMG_0001.JPG"
  touch "$JPEG_DIR/IMG_0002.JPG"

  run "$SCRIPT" "$TEST_DIR" --delete
  [ "$status" -eq 0 ]
  [[ "$output" == *"対応RAWなし: 0"* ]]
  [ -f "$JPEG_DIR/IMG_0001.JPG" ]
  [ -f "$JPEG_DIR/IMG_0002.JPG" ]
}

# --- edge cases ---

@test "empty RAW and JPEG directories" {
  run "$SCRIPT" "$TEST_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" == *".ReferenceJPEG内のファイル数: 0"* ]]
  [[ "$output" == *"対応RAWなし: 0"* ]]
}

@test "matches by filename stem regardless of extension" {
  touch "$RAW_DIR/IMG_0001.CR3"
  touch "$JPEG_DIR/IMG_0001.JPG"

  run "$SCRIPT" "$TEST_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" == *"対応RAWなし: 0"* ]]
}

@test "handles Japanese filenames correctly" {
  touch "$RAW_DIR/写真_001.ARW"
  touch "$JPEG_DIR/写真_001.JPG"
  touch "$JPEG_DIR/写真_002.JPG"

  run "$SCRIPT" "$TEST_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" == *"対応RAWなし: 1"* ]]
}

@test "handles filenames with spaces" {
  touch "$RAW_DIR/IMG 0001.ARW"
  touch "$JPEG_DIR/IMG 0001.JPG"
  touch "$JPEG_DIR/IMG 0002.JPG"

  run "$SCRIPT" "$TEST_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" == *"対応RAWなし: 1"* ]]
}

@test "detects all orphaned JPEGs when multiple exist" {
  touch "$RAW_DIR/IMG_0001.ARW"
  touch "$JPEG_DIR/IMG_0001.JPG"
  touch "$JPEG_DIR/IMG_0002.JPG"
  touch "$JPEG_DIR/IMG_0003.JPG"
  touch "$JPEG_DIR/IMG_0004.JPG"

  run "$SCRIPT" "$TEST_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" == *"対応RAWなし: 3"* ]]
}