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

| 項目       | 選定    | 理由                         |
|----------|-------|----------------------------|
| 言語       | Rust  | 型安全性、パフォーマンス、クロスプラットフォーム対応 |
| 非同期ランタイム | tokio | 事実上の標準、エコシステムとの親和性         |

### 主要ライブラリ

| 用途          | ライブラリ         | 備考                               |
|-------------|---------------|----------------------------------|
| HTTP クライアント | reqwest       | Google Drive API 呼び出し用           |
| データベース      | sqlx (SQLite) | コンパイル時SQL検証、async対応、マイグレーション機能内蔵 |
| OAuth       | oauth2        | PKCE 対応のデスクトップアプリ向け認証フロー         |
| 設定ファイル      | toml + serde  | Rust エコシステムとの親和性                 |
| CLI         | clap (derive) | 宣言的なサブコマンド定義                     |
| GUI         | Tauri v2      | 軽量、Rust バックエンド統合、モバイル対応          |

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
               共有リンク生成 → モデルに送信（手動）

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

### ユーザー識別（Phase 2 以降、要検討）

Relay は会員登録なしで使えることをコンセプトとする。
Phase 2 以降のモバイルアプリでは、通常配布の受信・加工リレーの参加の両方でユーザーを識別する統一的な仕組みが必要になる。

#### 要件

- 会員登録（メール/パスワード）は不要
- 通常配布と加工リレーで同じ識別方式を使う
- モバイルアプリの初回起動時に自動的にセットアップされる

#### 候補

| 方式              | 概要                      | 会員登録 | インフラ方式との対応           |
|-----------------|-------------------------|------|----------------------|
| デバイスID + トークン   | アプリ初回起動時にUUID生成、サーバーに登録 | 不要   | D1 / Turso 方式と親和性が高い |
| 公開鍵ペア（Nostr 互換） | アプリ内で鍵を自動生成、公開鍵がユーザーID  | 不要   | Nostr 方式と親和性が高い      |
| DID             | 分散型識別子                  | 必要   | AT Protocol と親和性が高い  |

#### インフラ方式との対応関係

インフラ方式を決めれば、ユーザー識別方式もほぼ自動的に決まる:

- D1 / Turso 方式 → デバイスID + ワンタイムトークン（招待リンクでセッション参加）
- Nostr 方式 → 公開鍵ペア（アプリ内自動生成、ユーザーに Nostr を意識させない）
- AT Protocol 方式 → DID（会員登録が必要になり、コンセプトと矛盾するため非推奨）

#### 検討ポイント

- 機種変更時のデータ移行（デバイスID は消える、鍵はバックアップが必要）
- 複数デバイスでの同一ユーザー識別
- 加工リレーへの参加フロー（リンク共有？アプリ内招待？）

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

| Crate      | Type | Binary  | Note     |
|------------|------|---------|----------|
| relay-core | lib  | -       | ドメインロジック |
| relay-cli  | bin  | `relay` | CLI ツール  |

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

| Command                                                                       | Description              |
|-------------------------------------------------------------------------------|--------------------------|
| `relay auth`                                                                  | Google Drive への OAuth 認証 |
| `relay upload <dir> --event <title> --date <YYYY-MM-DD> --recipients <names>` | 写真をアップロードして配布フォルダを作成     |
| `relay list`                                                                  | 配布一覧を表示                  |
| `relay status <id>`                                                           | 特定の配布の詳細を表示              |
| `relay copy <recipient>`                                                      | 配布メッセージをクリップボードにコピー      |
| `relay cleanup --older-than <days>`                                           | 古い配布を削除                  |
| `relay doctor`                                                                | 整合性チェック                  |

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

| Command                                                  | Description  |
|----------------------------------------------------------|--------------|
| `relay relay create <photo> --participants <names>`      | 加工リレーセッション作成 |
| `relay relay status <session_id>`                        | リレーの進行状況確認   |
| `relay relay reorder <session_id> --order <name1,name2>` | 参加者の順番を変更    |
| `relay relay complete <session_id>`                      | 自分の加工完了を報告   |

GUI ではドラッグ&ドロップで順番変更、プッシュ通知で順番通知を想定。

### インフラ設計（要検討）

中央 DB / サーバーはできる限り持たず、E2E でやり取りすることを理想とする。ただし信頼性とのトレードオフで D1 / Turso 方式も候補に含める。画像データはクラウドストレージ、状態管理・通知は分散型プロトコルまたはエッジ DB を使うハイブリッド構成を想定。

ハイブリッド構成のメリット:
- 中央サーバー / DB の運用コストがゼロ
- 画像は既存のクラウドストレージを活用するため追加容量不要
- 状態管理・通知を分散型プロトコルに任せることでE2E暗号化を実現
- ユーザーのデータが特定のサーバーに集約されないためプライバシーが高い

ハイブリッド構成のデメリット:
- 依存技術が増える（クラウドストレージ API + 分散型プロトコル）
- オフライン時の状態同期に工夫が必要（ローカル SQLite とのコンフリクト解消）
- 分散型プロトコルのリレー / PDS の可用性に依存する
- デバッグや障害調査が中央管理型に比べて難しい

```
[ハイブリッド構成]
画像データ:  クラウドストレージ（Google Drive 等）
状態同期:   分散型プロトコル（E2E 暗号化）
通知:       分散型プロトコル（リアルタイム）
ローカル:    SQLite（自分が関わるセッションのキャッシュ）
```

分散型プロトコルの候補:

| 観点         | Nostr          | AT Protocol (atproto.com) |
|------------|----------------|---------------------------|
| E2E 暗号化    | NIP-44 で標準サポート | 標準外（アプリ層で自前実装が必要）         |
| アカウント      | 公開鍵のみ、登録不要     | DID 必要（PDS 上にアカウント作成）     |
| インフラ依存     | 公開リレーサーバーを利用可  | PDS（自前ホスト or 既存サービス利用）    |
| Rust ライブラリ | nostr-sdk（成熟）  | atrium-api 等（発展途上）        |
| プロトコルの思想   | プライベート通信もOK    | 公開・半公開データ共有が主目的           |
| エコシステム     | シンプル、軽量        | Bluesky 連携可能、コスプレ界隈と親和性   |

#### Nostr のメリット・デメリット

メリット:
- E2E 暗号化が NIP-44 で標準サポートされており、追加実装なしでプライベート通信が可能
- 公開鍵だけで利用開始できるため、Relay のコンセプト（会員登録不要）と一致する
- アプリ内で鍵を自動生成すればユーザーに Nostr を意識させない設計にできる
- 公開リレーサーバーが多数あり、自前運用不要で冗長性も確保できる
- nostr-sdk（Rust）が成熟しており、実装コストが低い

デメリット:
- 一般ユーザーにとって Nostr の概念（公開鍵など）は馴染みがない
- リレーサーバーの永続性は保証されない（メッセージが消える可能性）
- Nostr 自体のユーザーベースは Bluesky と比べて小さい

#### AT Protocol のメリット・デメリット

メリット:
- Bluesky のエコシステムと直接連携可能（配布通知を Bluesky に投稿するなど）
- コスプレ界隈で Bluesky 利用者が増えており、ユーザーベースとの親和性が高い
- DID ベースの永続的な識別子でアカウントのポータビリティが高い
- Lexicon スキーマでカスタムデータ型を定義できる拡張性

デメリット:
- E2E 暗号化が標準サポートされておらず、アプリ層で自前実装が必要
- DID / PDS の概念が加工リレーにはオーバースペック
- アカウント作成が必要で、会員登録不要のコンセプトと矛盾する
- Rust ライブラリが発展途上で、実装コストが相対的に高い
- PDS の運用（自前ホスト or 外部依存）を考慮する必要がある
- 会員登録なしの統一ユーザー識別とは矛盾するため、加工リレーのインフラとしては非推奨

#### Cloudflare D1 (R2 ベース SQLite) による中央管理方式

完全 E2E ではなくなるが、ランニングコストがほぼゼロの中央管理方式も候補。

```
[D1 構成]
画像データ:  クラウドストレージ（Google Drive 等）
状態管理:   Cloudflare D1（SQLite）← Workers API 経由
通知:      Workers から Push / WebSocket
ローカル:   SQLite（キャッシュ）
```

メリット:
- メッセージ消失のリスクがない（永続的なストレージ）
- 状態管理のロジックがシンプル（通常の DB 操作）
- Cloudflare D1 の無料枠で十分運用可能（5GB ストレージ、500万行読み取り/日）
- Workers によるリアルタイム通知も実現可能
- デバッグや障害調査が容易

デメリット:
- 中央サーバーへの依存（Cloudflare がダウンするとリレー機能が停止）
- E2E 暗号化ではないため、理論上 Cloudflare 側でデータを閲覧可能
- 「中央 DB を持たない」というコンセプトからは外れる
- Workers / D1 の API 設計・デプロイの追加作業が必要

#### Turso (libSQL) による中央管理方式

D1 と同様にエッジ SQLite だが、Embedded Replicas によるローカル同期が特徴。

```
[Turso 構成]
画像データ:  クラウドストレージ（Google Drive 等）
状態管理:   Turso（libSQL）← HTTP / WebSocket 経由
ローカル:   Embedded Replica（libSQL、自動同期）
通知:      別途実装が必要（Workers 等）
```

メリット:
- Embedded Replicas でローカル SQLite とリモート DB の同期が組み込みで対応
  - オフライン時はローカルで読み書き → オンライン復帰時に自動同期
  - Relay の「ローカル SQLite + リモート同期」アーキテクチャと自然に合致
- libSQL は SQLite 互換のため、relay-core の sqlx コードをほぼそのまま使える
- 無料枠が大きい（9GB ストレージ、500 databases、1B 行読み取り/月）
- Cloudflare に依存しない（マルチクラウド対応）
- Rust クライアント（libsql crate）がある

デメリット:
- D1 同様、中央サーバーへの依存（Turso がダウンすると同期が停止、ただしローカルで動作は継続）
- E2E 暗号化ではない
- 通知機能は別途実装が必要（Turso 自体にはプッシュ通知の仕組みがない）
- D1 に比べてエコシステムの成熟度がやや低い

#### 方式の選定について

選定は実装フェーズで判断する。通知プロバイダー・状態同期プロバイダーのトレイト抽象化により、Nostr / AT Protocol / D1 / Turso のどの方式にも対応可能な設計とする。

なお、Turso の Embedded Replicas は Relay の「ローカル SQLite をメインに使いつつマルチユーザー同期もしたい」というアーキテクチャに最も自然に適合する。

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

| Component     | License           | Distribution            | Price  |
|---------------|-------------------|-------------------------|--------|
| relay-core    | MIT OR Apache-2.0 | crates.io               | 無料     |
| relay-cli     | MIT OR Apache-2.0 | crates.io, Homebrew     | 無料     |
| relay-mobile  | Proprietary       | App Store, Google Play  | 買い切り有料 |
| relay-desktop | Proprietary       | Gumroad / Lemon Squeezy | 買い切り有料 |

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

1. relay-desktop リポジトリ作成（プロプライエタリ）
2. React フロントエンド実装
3. Tauri コマンド統合
4. 配布・販売準備

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
