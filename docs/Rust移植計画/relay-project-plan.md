# Relay プロジェクト計画書

## 概要

Relay は写真家（主にコスプレ・ポートレート撮影者）、個人モデル（コスプレイヤー）向けの写真配布ツール。
撮影した写真をモデルに簡単かつ安全に届けることを目的とする。モデル起点の写真配布も対象。
ギガファイル便の代替として、広告のない安全な写真配布体験を提供する。
また、コスプレイヤー同士の併せの際には画像の加工リレー（レイヤーが自身の顔だけをレタッチして、次々に画像データを回すこと）があり、これをスムーズに行えるようにする。

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
- 併せ写真などの加工リレーをスムーズに進めたい

## プロジェクト目標

- ギガファイル便からユーザーを奪う
- カメラマンの配布作業を効率化する
- モデルに快適なダウンロード体験を提供する
- モデルの加工リレーを円滑にする
- 買い切りアプリとして収益化する

## 技術スタック

### 言語とランタイム

| Item    | Choice | Reason                                        |
|---------|--------|-----------------------------------------------|
| Lang    | Rust   | Type safety, performance, cross-platform      |
| Async   | tokio  | De facto standard, ecosystem compatibility    |

### 主要ライブラリ

| Purpose     | Library       | Note                                      |
|-------------|---------------|-------------------------------------------|
| HTTP client | reqwest       | Google Drive API calls                    |
| Database    | sqlx (SQLite) | Async, migration built-in                 |
| OAuth       | oauth2        | PKCE for desktop app auth flow            |
| Config      | toml + serde  | Rust ecosystem affinity                   |
| CLI         | clap (derive) | Declarative subcommand definition         |
| GUI         | Tauri v2      | Lightweight, Rust backend, mobile support |
| Error       | thiserror     | Unified across all crates                 |
| DateTime    | time          | Lighter than chrono, sqlx compatible      |
| Logging     | log           | Event emission only                       |

詳細な依存クレート一覧は「アーキテクチャ詳細」セクションを参照。

### 対応プラットフォーム

- macOS（デスクトップアプリはTauri v2）
- Windows（デスクトップアプリはTauri v2）
- iOS（Tauri v2）
- Android（Tauri v2）

### 対応ストレージサービス

- Google Drive（MVP）
- Dropbox（Phase 4 で対応）
- iCloud は API 制限のため対応しない
- Proton Drive は公式 API がないため対応しない
- Amazon Photos は API が非公開のため対応しない

## アーキテクチャ

### データフロー

```
[送信側（全フェーズ共通）]
ローカルの写真 → Relay CLI/App → クラウドストレージ (Google Drive)
                      ↓
               メタデータ (SQLite)
                      ↓
               共有リンク生成 → 対象者に送信（手動）

[受信側 - MVP（Phase 1）]
共有リンク → ブラウザ → Google Drive フォルダ → 閲覧・ダウンロード

[受信側 - Phase 2 以降]
共有リンク → Relay モバイルアプリ → プレビュー → 選択ダウンロード
                                         ↓
                                自分のストレージ（ローカル or Google Drive）に保存
```

### 設計方針

- 画像データはユーザーのクラウドストレージに保存（Relay は永続化しない）
- メタデータ（配布履歴、リンク情報）はローカルの SQLite で管理
- ストレージサービスはトレイトで抽象化し、プロバイダーを差し替え可能にする
- モバイル・デスクトップとも relay-core を共有し、最終的に送受信両対応を目指す
- UI/UX はプラットフォームごとに最適化する（一般的にはカメラマン=PC中心、モデル=スマホ中心だと思われる）
- Phase 2 ではモバイル受信側を優先し、Phase 3 で送信側 GUI を追加、最終的に全プラットフォーム全機能対応

### ユーザー識別（確定: Relay独自ID + OAuth認証プロバイダー）

Relay が独自のユーザーID（UUID）を発行し、Google OAuth は認証プロバイダーの1つとして紐付ける。

#### 方針

- アプリ初回認証時に Relay 内部ユーザーID が自動発行される（ユーザーに意識させない）
- Google OAuth は「認証手段」であり「ユーザーID」ではない
- 機種変更時は「Google でログイン → 既存の Relay ID に紐付く」で完了
- Phase 4 で Dropbox 対応時は同じ Relay ID に Dropbox 認証を追加するだけ
- Google BAN 等のリスクに備え、認証プロバイダーを差し替え可能にする

#### データモデル（Phase 2 で追加）

Phase 1 では users テーブルは不要（ローカル SQLite + OAuth トークンで動作）。
Phase 2 で Turso 同期を導入するタイミングで以下を追加する。

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE auth_providers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    provider TEXT NOT NULL,        -- 'google', 'dropbox', etc.
    provider_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, provider_user_id)
);
```

#### 認証レベル

| Action                           | Auth required  |
|----------------------------------|----------------|
| View via share link in browser   | None           |
| Preview/download in app          | Google login   |
| Join relay session               | Google login   |
| Upload/distribute photos         | Google login   |

#### リカバリ手段

すべての認証プロバイダーを失った場合のリカバリ手段は Phase 2 で検討する。

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
│   │   │   │   └── google_drive.rs
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

### プロプライエタリリポジトリ: `relay-app`

プライベートリポジトリ。ビルド済みバイナリのみ配布。
デスクトップ + モバイルを同一リポジトリで管理（Tauri v2 は `tauri ios` / `tauri android` で同一プロジェクトからビルド可能）。

```
relay-app/
├── src-tauri/
│   ├── Cargo.toml                # relay-core に依存
│   └── src/
├── src/                          # React フロントエンド
├── package.json
└── .github/workflows/
    ├── desktop.yml               # macOS / Windows ビルド
    └── mobile.yml                # iOS / Android ビルド
```

## クレート名とコマンド名

| Crate      | Type | Binary  | Note         |
|------------|------|---------|--------------|
| relay-core | lib  | -       | Domain logic |
| relay-cli  | bin  | `relay` | CLI tool     |

インストール: `cargo` or `homebrew` のカスタムTap
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
    pub event_title: String,               // "アコスタATC"
    pub event_date: NaiveDate,             // 2024-01-15
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

| Command                                                                       | Description                              |
|-------------------------------------------------------------------------------|------------------------------------------|
| `relay auth`                                                                  | OAuth authentication to Google Drive     |
| `relay upload <dir> --event <title> --date <YYYY-MM-DD> --recipients <names>` | Upload photos and create distribution    |
| `relay list`                                                                  | List all distributions                   |
| `relay status <id>`                                                           | Show details of a distribution           |
| `relay copy <recipient>`                                                      | Copy distribution message to clipboard   |
| `relay cleanup --older-than <days>`                                           | Delete old distributions                 |
| `relay doctor`                                                                | Integrity check (local DB vs remote)     |

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
$ relay upload ./photos --event "アコスタATC" --date 2024-01-15 --recipients "モデルA,モデルB"

✓ アップロード完了

【モデルA】
  写真: 15枚
  リンク: https://drive.google.com/drive/folders/xxxxx
  
  [クリップボードにコピー: relay copy モデルA]
```

`relay copy` でコピーされるメッセージ:

```
撮影データをお送りします！

https://drive.google.com/drive/folders/xxxxx

Google Driveアプリを入れておくと、より快適に閲覧・ダウンロードできるのでおすすめです。

このフォルダはXX日後に削除予定です。
```

## 加工リレー機能（Phase 2 以降）

コスプレイヤー同士の併せ写真で、各自が自分の顔だけをレタッチして順番に回す「加工リレー」をサポートする。

### データフロー

セッション作成・順番決定はカメラマン・モデルのどちらでも可能。

```
[順番制リレーフロー]
1. カメラマンまたはモデル: 併せ写真をアップロード → RelaySession 作成
2. 参加者間で順番を決定（アプリ上で並べ替え可能）
    ↓
3. レイヤーA に通知（順番が来た）
    ↓
4. レイヤーA: 画像をダウンロード → 自分の顔をレタッチ → アップロード（完了報告）
    ↓
5. レイヤーB に通知（順番が来た）
    ↓
6. レイヤーB: 画像をダウンロード → 自分の顔をレタッチ → アップロード（完了報告）
    ↓
7. 全員完了 → 全参加者に通知 → 完成画像を共有
```

### データモデル

```rust
/// 加工リレーセッション
pub struct RelaySession {
    pub id: String,                        // UUID
    pub distribution_id: String,
    pub photo_id: String,                  // 対象の写真
    pub created_by: String,                // セッション作成者（カメラマンまたはモデル）
    pub status: RelayStatus,               // Pending / InProgress / Completed
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// リレー参加者（順序付き）
pub struct RelayParticipant {
    pub id: String,                        // UUID
    pub session_id: String,
    pub recipient_id: String,
    pub order: u32,                        // リレー順序
    pub status: ParticipantStatus,         // Waiting / Active / Done
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

pub enum RelayStatus {
    Pending,
    InProgress,
    Completed,
}

pub enum ParticipantStatus {
    Waiting,
    Active,
    Done,
}
```

### CLI/GUI コマンド案

| Command                                                  | Description                 |
|----------------------------------------------------------|-----------------------------|
| `relay relay create <photo> --participants <names>`      | Create relay session        |
| `relay relay status <session_id>`                        | Check relay progress        |
| `relay relay reorder <session_id> --order <name1,name2>` | Reorder participants        |
| `relay relay complete <session_id>`                      | Report own editing complete |

GUI ではドラッグ&ドロップで順番変更、プッシュ通知で順番通知を想定。

### インフラ設計（確定: Turso）

加工リレー機能のマルチユーザー同期インフラとして Turso (libSQL) を採用する。

```
[Turso 構成]
画像データ:  クラウドストレージ（Google Drive 等）
状態管理:   Turso（libSQL）← HTTP / WebSocket 経由
ローカル:   Embedded Replica（libSQL、自動同期）
通知:      FCM（Firebase Cloud Messaging）
```

#### 選定理由

- Embedded Replicas でローカル SQLite とリモート DB の同期が組み込みで対応
  - オフライン時はローカルで読み書き → オンライン復帰時に自動同期
  - Relay の「ローカル SQLite + リモート同期」アーキテクチャと自然に合致
- libSQL は SQLite 互換のため、relay-core の sqlx コードをほぼそのまま使える
- 無料枠が大きい（9GB ストレージ、500 databases、1B 行読み取り/月）
- Rust クライアント（libsql crate）がある

#### 導入時期

- Phase 1（CLI MVP）: ローカル SQLite のみ。Turso 不要
- Phase 2（モバイル + 加工リレー）: Turso Embedded Replica を導入。`db/pool.rs` のみ差し替え

#### 移行パス

Phase 1 では `sqlx::query!`（コンパイル時検証マクロ）を使わず、`sqlx::query_as` + 手書き SQL を使用する。これにより Phase 2 で libsql crate に移行する際に SQL 文をそのまま再利用できる。

設定ファイルの拡張（Phase 2）:
```toml
[sync]
turso_url = "libsql://your-db.turso.io"
turso_auth_token = "..."
local_replica_path = "~/.local/share/relay/relay.db"
```

#### 通知

Turso 自体にプッシュ通知機能はないため、通知は FCM（Firebase Cloud Messaging）で別途実装する。relay-core に `NotificationProvider` トレイトを定義し、Phase 2 で FCM 実装を追加する。

#### 検討済みの他の候補（不採用）

| Candidate     | Reason for rejection                                                                      |
|---------------|-------------------------------------------------------------------------------------------|
| Nostr         | Key management unfamiliar to general users. Relay server persistence not guaranteed       |
| AT Protocol   | Requires account creation, contradicts "no registration" concept. Rust libraries immature |
| Cloudflare D1 | No built-in local sync. Turso Embedded Replica better fits Relay's architecture           |

### 実現性の考慮点

- 画像ストレージの設計は未定（カメラマンの Drive 上の共有フォルダ or 各自のストレージ、要検討）
- 順番制のため、状態管理が重要。ローカル SQLite にセッション/参加者の状態をキャッシュしつつ、分散型プロトコルで同期
- 通知が必須（順番が来たことを知らせる必要がある）→ 分散型プロトコルのリアルタイム通知を活用
- MVP（Phase 1）では加工リレーは含めない。Phase 2 のモバイルアプリと合わせて実装

## MVP スコープ

### 含める

- Google Drive 対応のみ
- CLI のみ（GUI なし）
- macOS / Windows クロスプラットフォーム
- 基本コマンド: auth, upload, list, status, copy, cleanup, doctor
- SQLite によるメタデータ管理
- TOML による設定ファイル

### 含めない（後のフェーズ）

- 加工リレー機能（Phase 2）
- Dropbox 対応（Phase 4）
- Tauri GUI（デスクトップ・モバイル）
- 自動通知機能（X DM、LINE など）
- 受信側アプリ（自分のストレージへの再アップロード機能）

## ビジネスモデル

### 配布方針

| Component  | License           | Distribution           | Price                  |
|------------|-------------------|------------------------|------------------------|
| relay-core | MIT OR Apache-2.0 | crates.io              | Free                   |
| relay-cli  | MIT OR Apache-2.0 | crates.io, Homebrew    | Free                   |
| relay-app  | Proprietary       | App Store, Google Play | Paid (one-time)        |
| relay-app  | Proprietary       | Lemon Squeezy          | Paid (one-time)        |
| Relay func | -                 | In-app / Lemon Squeezy | Subscription (monthly) |

### 課金プラットフォーム

| Platform             | Payment method              | Features                            |
|----------------------|-----------------------------|-------------------------------------|
| Mobile (iOS/Android) | App Store / Google Play IAP | Standard platform billing           |
| Desktop (macOS/Win)  | Lemon Squeezy               | MoR (tax handling), license key API |

Lemon Squeezy を選定した理由:
- MoR（Merchant of Record）型で消費税/VAT の申告・納付を代行
- ライセンスキー API 付き（購入時に自動発行、アプリ内で HTTP API 検証）
- 月額費用 0 円（売上発生時のみ手数料 6.5% + $0.50/取引）
- 買い切り + サブスク両対応
- Stripe 傘下で長期安定性あり
- 日本の銀行口座へのペイアウト対応済み

規模拡大後の移行先候補: Stripe + Keygen（手数料 3.6% に最適化、Keygen は 100 ユーザーまで無料）

### 理由

- CLI を OSS にすることで信頼性を確保（ソースコード公開）
- CLI を使えるユーザーは少数なので、GUI の売上への影響は限定的
- Homebrew 公式リポジトリへの登録には OSS が必要
- OSS コミュニティからのフィードバック・コントリビューションが期待できる

## 開発フェーズ

### Phase 1: CLI（MVP）

1. OSS リポジトリの雛形作成
2. relay-core の骨格実装（トレイト定義、モデル、DB）
3. Google Drive OAuth 認証フロー実装
4. Google Drive ファイル操作実装
5. relay-cli コマンド実装
6. 実際のイベントでテスト

### Phase 2: モバイルアプリ（受信側）

Tauri v2 のモバイル対応を使用。

1. iOS / Android アプリの基盤構築
2. 共有リンクからの写真プレビュー・ダウンロード機能
3. 選択した写真を自分のクラウドストレージに保存する機能
4. プッシュ通知（オプション）

モデル（受信側）の多くはスマホのみで活動しているため、デスクトップ GUI より優先度が高い。

### Phase 3: デスクトップアプリ（送信側 GUI）

1. relay-app リポジトリ作成（プロプライエタリ、モバイルと同一リポジトリ）
2. React フロントエンド実装
3. Tauri コマンド統合
4. 配布・販売準備（Lemon Squeezy でライセンスキー販売）

### Phase 4: 機能拡張

1. Dropbox 対応（DropboxProvider 実装）
2. 自動通知機能（intent URL / ブラウザ起動）
3. 複数プラットフォーム通知対応（LINE, Discord, Bluesky）
4. P2P / E2E 暗号化通知（Nostr 等）

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

## アーキテクチャ詳細

### relay-core 内部モジュール設計

```
relay-core/src/
├── lib.rs
├── error.rs              # RelayError 統一エラー型
├── storage/
│   ├── mod.rs
│   ├── traits.rs         # StorageProvider トレイト
│   ├── types.rs          # RemoteFile, RemoteFolder, ShareLink
│   └── google_drive/
│       ├── mod.rs
│       ├── client.rs     # GoogleDriveProvider 実装
│       ├── api.rs        # REST API 呼び出し
│       └── upload.rs     # マルチパートアップロード
├── db/
│   ├── mod.rs
│   ├── pool.rs           # DB 接続管理（Phase 2 で Turso 切替のキーファイル）
│   ├── distribution.rs   # Distribution CRUD
│   ├── recipient.rs      # Recipient CRUD
│   └── photo.rs          # Photo CRUD
├── auth/
│   ├── mod.rs
│   ├── oauth.rs          # OAuth 2.0 PKCE フロー
│   ├── token.rs          # トークン永続化・リフレッシュ
│   └── callback.rs       # ローカル HTTP サーバー（リダイレクト受信）
├── config/
│   ├── mod.rs
│   ├── app_config.rs     # TOML 設定の型・読み書き
│   └── paths.rs          # XDG ベースディレクトリ（dirs crate）
├── models/
│   ├── mod.rs
│   ├── distribution.rs
│   ├── recipient.rs
│   ├── photo.rs
│   └── relay.rs          # Phase 2 用スタブ（空ファイル）
├── template/
│   ├── mod.rs
│   └── message.rs        # メッセージテンプレート（str::replace ベース）
└── notification/
    ├── mod.rs
    └── traits.rs          # NotificationProvider トレイト（Phase 2 用）
```

### 依存クレート（最小構成方針）

依存ライブラリは最小限に抑える。std や簡単なヘルパーで代替できるものは外部クレートを使わない。

relay-core (11 crates):

| Purpose  | Crate                   | Note                                                   |
|----------|-------------------------|--------------------------------------------------------|
| Async    | tokio                   | features = ["full"]                                    |
| HTTP     | reqwest                 | features = ["json", "multipart", "stream"]             |
| DB       | sqlx                    | features = ["runtime-tokio", "sqlite", "time", "uuid"] |
| OAuth    | oauth2                  | PKCE support. Security-critical, no DIY                |
| Config   | toml, serde, serde_json |                                                        |
| Error    | thiserror               | Structured errors for library crate                    |
| DateTime | time                    | Lighter than chrono. sqlx time feature                 |
| UUID     | uuid                    | features = ["v4", "serde"]                             |
| Paths    | dirs                    | XDG dirs (cross-platform safety)                       |
| Logging  | log                     | Event emission only. Lighter than tracing              |

relay-cli (additional 2 crates):

| Purpose    | Crate      | Note                              |
|------------|------------|-----------------------------------|
| CLI        | clap       | derive feature                    |
| Log output | env_logger | Lighter than tracing-subscriber   |

エラーは thiserror で統一（anyhow 不使用）。relay-cli 用の CliError 型を定義する。

外部クレート不使用（std::process::Command 等で代替）:

| Feature      | Alternative                                         |
|--------------|-----------------------------------------------------|
| Clipboard    | `pbcopy`(macOS) / `clip`(Win) via Command           |
| Browser open | `open`(macOS) / `start`(Win) via Command            |
| Color output | ANSI escape codes or no color                       |
| Progress     | `println!("Uploading 3/10...")`                     |
| Template     | `str::replace` chain (simple variable substitution) |

async-trait: Rust 1.75+ で `async fn in trait` が安定化済み。Phase 1 では Google Drive のみなのでジェネリクス（静的ディスパッチ）で十分、不要。Phase 4 で Dropbox 追加時に `dyn StorageProvider` が必要になったら再検討。

### エラーハンドリング

全体を `thiserror` で統一（anyhow 不使用、依存最小化）。

```
RelayError (relay-core unified error type)
├── StorageError (NotAuthenticated, FileNotFound, RateLimited, ApiError, Http, Io)
├── AuthError (Cancelled, RefreshFailed, TokenFileError, CallbackServerError)
├── DbError (NotFound, MigrationFailed, Sqlx)
├── ConfigError (NotFound, ParseError, Io)
└── TemplateError (RenderFailed, NotFound)

CliError (relay-cli top-level error type)
├── Relay(#[from] RelayError)
├── Io(#[from] std::io::Error)
└── Other(String)
```

### ロギング

- relay-core: `log` マクロでイベント発行のみ。出力先は決めない
- relay-cli: `env_logger` でターミナル出力
- Tauri: `env_logger` or Tauri 組み込みログ
- relay-core のログは英語（OSS）、relay-cli のユーザー向け `println!` は日本語

| Level | Usage                                              |
|-------|----------------------------------------------------|
| error | Unrecoverable (auth failure, DB corruption)        |
| warn  | Attention needed (token expired, inconsistency)    |
| info  | User-facing progress (upload start/complete)       |
| debug | Developer details (API request/response, SQL)      |

### テスト戦略

| Layer          | Target                       | Tools                                  | Execution   |
|----------------|------------------------------|----------------------------------------|-------------|
| Unit           | config, template, models, db | `#[cfg(test)]` + SQLite in-memory      | CI required |
| Integration    | Multi-module workflows       | tests/ + MockStorageProvider + tempdir | CI required |
| E2E (real API) | Google Drive operations      | `#[ignore]` + env var guard            | Manual only |

MockStorageProvider: `pub mod testutil` として relay-core から公開。HashMap ベースのインメモリ実装。

### テンプレートシステム

外部テンプレートエンジンは使わず、`str::replace` チェーンで実装。

テンプレートの保存方法:
- Phase 1（CLI）: デフォルトテンプレートは `include_str!` でバイナリ埋め込み。カスタムテンプレートは `template_dir` 設定でファイルシステムから読み込み
- Phase 2（モバイル）以降: SQLite に `templates` テーブルを追加。アプリ内 UI で編集・プレビュー。Turso 同期でデバイス間共有

### Phase 間の拡張ポイント

Phase 1 → 2 (Turso 統合):
- 変更対象は `db/pool.rs` のみ
- `sqlx::query!` は使わない（`sqlx::query_as` + 手書き SQL で libsql 移行時に再利用可能）
- 設定に `[sync]` セクションを追加

Phase 2 (加工リレー追加):
- `models/relay.rs` に RelaySession, RelayParticipant 定義
- `db/relay_session.rs` 追加
- `notification/fcm.rs` 追加

Phase 4 (Dropbox 追加):
- `storage/dropbox/` ディレクトリ追加
- `DropboxProvider` が既存 `StorageProvider` トレイトを実装するだけ

### CI/CD パイプライン

relay（OSS）:
- ci.yml: fmt, clippy, test, cargo-deny（ライセンス・脆弱性チェック）
- release.yml: タグプッシュ時にクロスビルド → GitHub Release にバイナリアップロード
- ビルド対象: macOS (x86 + arm), Windows

relay-app（プロプライエタリ）:
- desktop.yml: tauri-action で macOS / Windows ビルド
- mobile.yml: Tauri mobile ビルド（iOS / Android）

## 今後の検討事項

- Homebrew での `relay` コマンド名の競合確認
- Google OAuth 同意画面の審査プロセス
- repair コマンドの詳細仕様

## 将来の拡張: P2P / E2E 暗号化通知

中央サーバーを経由せず、かつ第三者に内容を見られない通知機能の可能性について。

### 技術的選択肢

| Method             | Feature                          | Challenge                                     |
|--------------------|----------------------------------|-----------------------------------------------|
| WebRTC DataChannel | Browser-to-browser P2P           | Both parties must be online, signaling needed |
| Matrix             | Decentralized, E2E encryption    | Federation, not true P2P                      |
| Signal Protocol    | Robust E2E                       | Delivery server required                      |
| Nostr              | Decentralized, pubkey, no signup | Key management hard for general users         |

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
