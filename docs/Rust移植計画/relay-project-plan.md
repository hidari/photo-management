# Relay プロジェクト計画書

## 概要

Relay は写真家（主にコスプレ・ポートレート撮影者）向けの写真配布ツール。撮影した写真をモデルに簡単かつ安全に届けることを目的とする。ギガファイル便の代替として、広告のない安全な写真配布体験を提供する。

## 背景と課題

### 既存サービスの問題点

ギガファイル便などの既存ファイル転送サービスには以下の課題がある。

- 広告が邪悪な挙動をする（誤タップ誘導など）
- セキュリティ面での不安
- スマホアプリが使いづらく、容量を食う
- zip 配布方式はスマホユーザーにとって不便（ストレージ圧迫、選択的ダウンロード不可）

### ターゲットユーザーのニーズ

- スマホのみで活動するモデルが多い
- 必要な写真だけを選んでダウンロードしたい
- ダウンロード前にプレビューしたい
- 会員登録なしで使いたい

## プロジェクト目標

- ギガファイル便からユーザーを奪う
- カメラマンの配布作業を効率化する
- モデルに快適なダウンロード体験を提供する
- 買い切りアプリとして収益化する

## 技術スタック

### 言語とランタイム

| 項目 | 選定 | 理由 |
|------|------|------|
| 言語 | Rust | 型安全性、パフォーマンス、クロスプラットフォーム対応 |
| 非同期ランタイム | tokio | 事実上の標準、エコシステムとの親和性 |

### 主要ライブラリ

| 用途 | ライブラリ | 備考 |
|------|------------|------|
| HTTP クライアント | reqwest | Google Drive / Dropbox API 呼び出し用 |
| データベース | sqlx (SQLite) | コンパイル時SQL検証、async対応、マイグレーション機能内蔵 |
| OAuth | oauth2 | PKCE 対応のデスクトップアプリ向け認証フロー |
| 設定ファイル | toml + serde | Rust エコシステムとの親和性 |
| CLI | clap (derive) | 宣言的なサブコマンド定義 |
| GUI (将来) | Tauri v2 | 軽量、Rust バックエンド統合 |

### 対応プラットフォーム

- macOS
- Windows
- (将来) iOS / Android（Tauri v2 モバイル）

### 対応ストレージサービス

- Google Drive（MVP）
- Dropbox（後のフェーズ）
- iCloud は API 制限のため対応しない

## アーキテクチャ

### データフロー

```
[カメラマン側]
ローカルの写真 → Relay CLI/App → クラウドストレージ (Google Drive/Dropbox)
                      ↓
               メタデータ (SQLite)
                      ↓
               共有リンク生成 → モデルに送信（手動）

[モデル側]
共有リンク → ブラウザ → プレビュー → 選択ダウンロード
```

### 設計方針

- 画像データはユーザーのクラウドストレージに保存（Relay は永続化しない）
- メタデータ（配布履歴、リンク情報）はローカルの SQLite で管理
- ストレージサービスはトレイトで抽象化し、プロバイダーを差し替え可能にする

## リポジトリ構成

OSS 部分とプロプライエタリ部分を分離する。

### OSS リポジトリ: `relay`

公開リポジトリ。MIT OR Apache-2.0 デュアルライセンス。

```
relay/
├── Cargo.toml                    # workspace 定義
├── LICENSE-MIT
├── LICENSE-APACHE
├── README.md
├── crates/
│   ├── relay-core/               # コアライブラリ
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── storage/          # ストレージ抽象化層
│   │   │   │   ├── mod.rs
│   │   │   │   ├── traits.rs     # StorageProvider トレイト
│   │   │   │   ├── google_drive.rs
│   │   │   │   └── dropbox.rs
│   │   │   ├── db/               # SQLite 操作
│   │   │   ├── auth/             # OAuth 関連
│   │   │   ├── config/           # 設定管理
│   │   │   └── models/           # ドメインモデル
│   │   └── migrations/           # SQLite マイグレーション
│   │
│   └── relay-cli/                # CLI バイナリ
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs
│           └── commands/         # サブコマンド実装
│
└── config/                       # デフォルト設定ファイル
```

### プロプライエタリリポジトリ: `relay-desktop`

プライベートリポジトリ。ビルド済みバイナリのみ配布。

```
relay-desktop/
├── src-tauri/
│   ├── Cargo.toml                # relay-core に依存
│   └── src/
├── src/                          # React フロントエンド
├── package.json
└── README.md
```

## クレート名とコマンド名

| クレート名 | 種別 | バイナリ名 | 備考 |
|------------|------|------------|------|
| relay-core | ライブラリ | - | ドメインロジック |
| relay-cli | バイナリ | `relay` | CLI ツール |

インストール: `cargo install relay-cli`
実行: `relay <subcommand>`

## ストレージ抽象化

```rust
#[async_trait]
pub trait StorageProvider: Send + Sync {
    /// 認証済みかどうか
    fn is_authenticated(&self) -> bool;
    
    /// OAuth 認証フローを開始
    async fn authenticate(&mut self) -> Result<(), StorageError>;
    
    /// ファイルをアップロード
    async fn upload_file(
        &self,
        local_path: &Path,
        remote_folder_id: &str,
    ) -> Result<RemoteFile, StorageError>;
    
    /// フォルダを作成
    async fn create_folder(
        &self,
        name: &str,
        parent_id: Option<&str>,
    ) -> Result<RemoteFolder, StorageError>;
    
    /// 共有リンクを生成
    async fn create_share_link(
        &self,
        file_or_folder_id: &str,
    ) -> Result<ShareLink, StorageError>;
    
    /// フォルダ内のファイル一覧
    async fn list_files(
        &self,
        folder_id: &str,
    ) -> Result<Vec<RemoteFile>, StorageError>;
    
    /// ファイル/フォルダを削除
    async fn delete(&self, id: &str) -> Result<(), StorageError>;
}
```

## データモデル

### SQLite スキーマ

```rust
/// 配布イベント（撮影会ごと）
pub struct Distribution {
    pub id: String,                        // UUID
    pub name: String,                      // "アコスタATC 2024-01-15"
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub storage_provider: StorageProviderType,
    pub remote_folder_id: String,
}

/// 配布対象者（モデルごと）
pub struct Recipient {
    pub id: String,
    pub distribution_id: String,
    pub name: String,                      // モデルの名前
    pub folder_id: String,                 // クラウド上のフォルダID
    pub share_link: String,                // 共有URL
    pub photo_count: u32,
    pub notified_at: Option<DateTime<Utc>>,
}

/// アップロードした写真
pub struct Photo {
    pub id: String,
    pub recipient_id: String,
    pub local_path: String,                // 元のローカルパス
    pub remote_id: String,                 // クラウド上のファイルID
    pub filename: String,
    pub size_bytes: u64,
    pub uploaded_at: DateTime<Utc>,
}
```

### マイグレーション管理

sqlx のマイグレーション機能を使用。アプリ起動時に未適用のマイグレーションを自動適用する。

```
relay-core/migrations/
├── 20240115_000001_initial.sql
├── 20240220_000002_add_expires_at.sql
└── ...
```

## CLI サブコマンド

### MVP で実装するコマンド

| コマンド | 説明 |
|----------|------|
| `relay auth` | Google Drive への OAuth 認証 |
| `relay upload <dir> --event <name> --recipients <names>` | 写真をアップロードして配布フォルダを作成 |
| `relay list` | 配布一覧を表示 |
| `relay status <id>` | 特定の配布の詳細を表示 |
| `relay copy <recipient>` | 配布メッセージをクリップボードにコピー |
| `relay cleanup --older-than <days>` | 古い配布を削除 |
| `relay doctor` | 整合性チェック |

### doctor コマンドの出力例

```
$ relay doctor

Relay Doctor v0.1.0
==================

[認証状態]
  ✓ Google Drive: 認証済み (user@example.com)
  - Dropbox: 未設定

[設定ファイル]
  ✓ ~/.config/relay/config.toml: 有効

[データベース]
  ✓ ~/.local/share/relay/relay.db: 正常
  ✓ スキーマバージョン: 3 (最新)

[ストレージ整合性]
  ⚠ 配布 "アコスタATC 2024-01-15":
    - ローカルDB: 45枚
    - リモート(Google Drive): 43枚
    - 差分: 2ファイルがリモートに存在しません
    
  ✓ 配布 "コミケ C103": 整合性OK (32枚)

問題が見つかりました。`relay repair` で修復を試みることができます。
```

### 通知機能（MVP）

MVP では自動通知は実装せず、メッセージテンプレートの生成とクリップボードコピーで対応する。

```
$ relay upload ./photos --event "アコスタATC" --recipients "モデルA,モデルB"

✓ アップロード完了

【モデルA】
  写真: 15枚
  リンク: https://drive.google.com/drive/folders/xxxxx
  
  [クリップボードにコピー: relay copy モデルA]
```

`relay copy` でコピーされるメッセージ:

```
📸 撮影データをお送りします！

【写真フォルダ】
https://drive.google.com/drive/folders/xxxxx

必要な写真を選んで個別にダウンロードすることも、
フォルダごと一括でzipダウンロードすることもできます。

📱 Google Driveアプリを入れておくと、
   より快適に閲覧・ダウンロードできるのでおすすめです。

⏰ このフォルダは30日後に削除予定です。
```

## MVP スコープ

### 含める

- Google Drive 対応のみ
- CLI のみ（GUI なし）
- macOS / Windows クロスプラットフォーム
- 基本コマンド: auth, upload, list, status, copy, cleanup, doctor
- SQLite によるメタデータ管理
- TOML による設定ファイル

### 含めない（後のフェーズ）

- Dropbox 対応
- Tauri GUI
- モバイルアプリ
- 自動通知機能（X DM、LINE など）
- 受信側アプリ（自分のストレージへの再アップロード機能）

## ビジネスモデル

### 配布方針

| コンポーネント | ライセンス | 配布方法 | 価格 |
|----------------|------------|----------|------|
| relay-core | MIT OR Apache-2.0 | crates.io | 無料 |
| relay-cli | MIT OR Apache-2.0 | crates.io, Homebrew | 無料 |
| relay-desktop | プロプライエタリ | Gumroad / Lemon Squeezy | 買い切り有料 |

### 理由

- CLI を OSS にすることで信頼性を確保（ソースコード公開）
- CLI を使えるユーザーは少数なので、GUI の売上への影響は限定的
- Homebrew 公式リポジトリへの登録には OSS が必要
- OSS コミュニティからのフィードバック・コントリビューションが期待できる

## 開発フェーズ

### Phase 1: MVP（CLI）

1. OSS リポジトリの雛形作成
2. relay-core の骨格実装（トレイト定義、モデル、DB）
3. Google Drive OAuth 認証フロー実装
4. Google Drive ファイル操作実装
5. relay-cli コマンド実装
6. 実際のイベントでテスト

### Phase 2: Dropbox 対応

1. DropboxProvider 実装
2. CLI でのプロバイダー切り替え対応

### Phase 3: Tauri GUI

1. relay-desktop リポジトリ作成
2. React フロントエンド実装
3. Tauri コマンド統合
4. 配布・販売準備

### Phase 4: 拡張機能

1. 自動通知機能（intent URL / ブラウザ起動）
2. モバイルアプリ（受信側）
3. 複数プラットフォーム通知対応（LINE, Discord, Bluesky）

## API 利用コスト

### Google Drive API

- API 利用自体は無料
- クォータ制限（1日50万リクエスト程度）を超えても課金されない（レート制限のみ）
- OAuth 同意画面の審査が必要（無料だが手間がかかる）

### Dropbox API

- API 利用は無料
- 本番環境への昇格に審査が必要

### 共通の要件

- プライバシーポリシーの公開が必須
- 審査に通らないリスクはある

## 今後の検討事項

- Homebrew での `relay` コマンド名の競合確認
- Google OAuth 同意画面の審査プロセス
- GUI アプリの価格設定
- 配布メッセージのテンプレートカスタマイズ機能
- repair コマンドの詳細仕様

## 将来の拡張: P2P / E2E 暗号化通知

中央サーバーを経由せず、かつ第三者に内容を見られない通知機能の可能性について。

### 技術的選択肢

| 方式 | 特徴 | 課題 |
|------|------|------|
| WebRTC DataChannel | ブラウザ間 P2P | 両者が同時オンライン必須、シグナリングサーバー必要 |
| Matrix | 分散型、E2E暗号化標準 | 完全 P2P ではなくフェデレーション型 |
| Signal プロトコル | 堅牢な E2E | 配送サーバー必要 |
| Nostr | 分散型、公開鍵ベース、登録不要 | 一般ユーザーへの鍵管理の説明が難しい |

### 現実的な落としどころ

「完全な P2P」と「オフラインでも届く」は本質的に両立しない。相手がオンラインでないと P2P 通信は成立しないため。現実的には「E2E 暗号化」+「分散型（特定の中央サーバーに依存しない）」の組み合わせになる。

### 推奨案: Nostr

Relay のコンセプト（会員登録不要）と親和性が高い。モデル側は Nostr の公開鍵を共有するだけでよく、リレーサーバーの冗長性もある。Rust ライブラリ（nostr-sdk）も成熟してきている。

アプリ内で鍵生成を自動化し、ユーザーには Nostr を意識させない設計にすることで、ハードルを下げられる可能性がある。

### 設計上の考慮

relay-core に通知プロバイダーの抽象化層を用意しておくと、後から追加しやすい。

```rust
#[async_trait]
pub trait NotificationProvider: Send + Sync {
    async fn send(&self, recipient: &str, message: &str) -> Result<(), NotifyError>;
}
```

この設計により、MVP の IntentUrlNotifier（ブラウザ起動方式）から、将来的に NostrNotifier などへ拡張可能。
