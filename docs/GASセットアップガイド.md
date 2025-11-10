# Google Apps Script 開発環境セットアップガイド（Denoプロジェクト向け）

このガイドでは、既にDenoをメインランタイムとして使用しているプロジェクトに、Google Apps Script（GAS）開発環境を統合する方法を解説します。
Denoで書かれた既存のツール群と共存しながら、GASの開発も快適に行えるようにします。

## 前提条件と既存のプロジェクト構成

このガイドは、以下のような構成のプロジェクトを対象としています。

まず、プロジェクトのメインのツール群がDenoで実装されていることが前提です。
Denoは標準でTypeScriptをサポートしているため、TypeScriptファイルを直接実行できます。
また、セキュアバイデフォルトの設計により、必要な権限だけを明示的に指定してスクリプトを実行します。

次に、開発ツール（lintやフォーマッター）としてBiomeを使用していることを想定しています。BiomeはNode.jsのパッケージとして提供されているため、pnpmで管理されています。つまり、プロジェクトには既にpackage.jsonとpnpm-lock.yamlが存在し、BiomeがdevDependenciesに含まれている状態です。

そして、これからGAS開発環境を追加するにあたり、apps-scriptディレクトリをGAS専用の領域として使用します。このディレクトリ内にTypeScriptのソースコード、コンパイル済みのJavaScript、clasp関連の設定ファイルを配置します。

## セットアップの全体像と設計方針

GAS開発環境を既存のDenoプロジェクトに統合するにあたり、いくつかの重要な設計方針があります。これらの方針を理解しておくと、なぜこのような設定にするのかが明確になります。

まず、ツールとランタイムの役割分担を明確にします。Denoは、プロジェクトのメインツール（イベントの初期化、READMEの生成、アーカイブの作成など）の実行環境として使用します。一方、Node.jsエコシステム（pnpm）は、開発ツール（Biome、clasp、TypeScriptコンパイラ）の管理に使用します。GASのビルドとデプロイも、Node.jsエコシステムのツールで行います。

次に、パッケージ管理を一箇所に集約します。apps-scriptディレクトリ内に独立したpackage.jsonを作るのではなく、トップレベルのpackage.jsonにGAS関連のパッケージも追加します。これにより、依存関係の管理がシンプルになり、package.jsonとpnpm-lock.yamlが一つで済みます。

さらに、コードスタイルを統一します。既存のBiomeの設定を活用して、apps-script内のTypeScriptファイルも、他のファイルと同じlintとフォーマットのルールを適用します。これにより、プロジェクト全体でコーディングスタイルが統一されます。

そして、ビルドプロセスを分離します。Denoのタスク（deno.jsonで定義）とGASのビルド（pnpmのスクリプトで定義）は、明確に分離します。これにより、それぞれの領域が独立して進化でき、混乱を避けられます。

## セットアップに使用するツール

これから構築する環境では、以下のツールを使用します。それぞれがどのような役割を持ち、なぜ必要なのかを理解しておきましょう。

**clasp**は、Google公式のコマンドラインツールです。ローカルで書いたコードをGoogle Apps Scriptのプロジェクトにアップロードしたり、逆にダウンロードしたりできます。claspはNode.jsのパッケージとして提供されているため、pnpmでインストールします。これにより、好きなエディタでGASのコードを開発できるようになります。

**TypeScript**は、JavaScriptに型システムを追加した言語です。Denoは標準でTypeScriptをサポートしていますが、GASのビルドでは、特定のTypeScript設定（ES2019をターゲットにする、モジュールシステムを使わないなど）が必要になります。そのため、TypeScriptコンパイラ（tsc）を使って、GAS用にTypeScriptをJavaScriptにトランスパイルします。

**@types/google-apps-script**は、GASのAPIの型定義ファイルです。これをインストールすると、DriveApp、SpreadsheetApp、MailAppなどのGAS固有のAPIに対して、IDEの補完が効くようになります。また、TypeScriptの型チェックも正しく機能するようになります。

**Biome**は、既にプロジェクトで使用している、lintとフォーマットのツールです。apps-script内のTypeScriptファイルも、既存のBiomeの設定でlintとフォーマットを行います。新しい設定ファイルを作る必要はなく、既存の設定を活用します。

## ステップ1：現在のプロジェクト構成の確認

まず、既存のプロジェクト構成を確認し、これから追加するGAS開発環境がどこに配置されるのかを理解しましょう。

あなたのプロジェクトのルートディレクトリには、既にいくつかの重要なファイルが存在しているはずです。package.jsonは、Biomeなどの開発ツールの依存関係を管理しています。pnpm-lock.yamlは、インストールされたパッケージのバージョンをロックしています。deno.jsonは、Denoで実行する様々なタスクを定義しています。biome.jsoncは、プロジェクト全体のlintとフォーマットのルールを定義しています。

そして、toolsディレクトリには、Denoで書かれた自動化スクリプトが配置されています。testsディレクトリには、それらのスクリプトのテストが入っています。typesディレクトリには、プロジェクト全体で使用する型定義が入っています。

これからGAS開発環境を追加するのは、apps-scriptディレクトリです。現在、このディレクトリには、cleanup-scheduler.gsというGASのスクリプトファイルと、README.mdが入っているだけですが、これからここにTypeScriptのソースコード、コンパイル設定、clasp設定などを追加していきます。

この構成を理解しておくことで、なぜ特定のファイルを特定の場所に配置するのかが明確になります。DenoとNode.jsの役割分担、既存のツールとの統合方法が、全体像として見えてくるはずです。

## ステップ2：GAS開発に必要なパッケージの追加

既存のpackage.jsonに、GAS開発に必要なパッケージを追加します。これらのパッケージは全てdevDependenciesに追加されます。なぜdevDependenciesかというと、これらは開発時にのみ必要なツールであり、実行時（GASの実行環境）には必要ないからです。

ターミナルでプロジェクトのルートディレクトリに移動し、以下のコマンドを実行してください。

```bash
pnpm add -D @google/clasp typescript @types/google-apps-script
```

このコマンドが何をしているのか、一つずつ見ていきましょう。`pnpm add -D`は、パッケージをdevDependenciesに追加するコマンドです。`-D`フラグは`--save-dev`の短縮形で、これによりpackage.jsonのdevDependenciesセクションにパッケージが記録されます。

**@google/clasp**は、claspのパッケージです。claspは、ローカルのコードをGASプロジェクトと同期するためのツールです。以前はグローバルにインストールすることが一般的でしたが、プロジェクトのdevDependenciesに含めることで、チームメンバーが環境構築する際に、`pnpm install`だけで全ての依存関係がインストールされるようになります。これにより、「あなたの環境では動くけど、私の環境では動かない」という問題を避けられます。

**typescript**は、TypeScriptコンパイラです。TypeScriptファイルをJavaScriptファイルに変換するために使用します。あなたのプロジェクトでは、Denoが標準でTypeScriptをサポートしているため、toolsディレクトリのスクリプトではTypeScriptコンパイラは不要でした。しかし、GASのビルドでは、特定のターゲット（ES2019）や設定（モジュールシステムを使わない）でコンパイルする必要があるため、TypeScriptコンパイラを明示的に使用します。

**@types/google-apps-script**は、GASのAPIの型定義ファイルです。これがあると、DriveApp、SpreadsheetApp、MailAppなどのGAS固有のAPIを使う際に、TypeScriptが正しく型チェックを行い、IDEで補完が効くようになります。たとえば、`DriveApp.getFolderById()`と入力すると、IDEがこのメソッドの引数や戻り値の型を表示してくれます。これにより、typoによるバグや、間違った型の引数を渡すミスを、実行前に検出できます。

インストールが完了すると、package.jsonのdevDependenciesセクションに、これら三つのパッケージが追加されます。また、pnpm-lock.yamlも更新されて、インストールされたパッケージの正確なバージョンが記録されます。node_modulesディレクトリには、これらのパッケージとその依存関係が全てインストールされます。

既にBiomeがdevDependenciesに含まれているはずですが、今回追加したパッケージはBiomeと共存します。つまり、あなたのpackage.jsonには、開発ツールとして、Biome、clasp、TypeScript、型定義の四つが含まれることになります。これらは全て「コードを書く」「ビルドする」「デプロイする」という開発プロセスを支援するツールであり、統一的に管理されます。

## ステップ3：claspでGoogleアカウントにログイン

claspを使ってGASプロジェクトを操作するには、Googleアカウントの認証が必要です。プロジェクトのdevDependenciesとしてclaspをインストールしたので、npxまたはpnpm execを使ってclaspコマンドを実行します。

ターミナルで以下のコマンドを実行してください。

```bash
pnpm exec clasp login
```

このコマンドを実行すると、ブラウザが自動的に開き、Googleアカウントの認証画面が表示されます。GASを使用したいGoogleアカウントでログインし、claspがあなたのGoogle Driveとスクリプトにアクセスすることを許可してください。

認証のプロセスを少し詳しく説明すると、まずGoogleの認証画面で、claspが要求する権限を確認します。claspは、あなたのスクリプトファイルを読み書きするために、Google Driveへのアクセス権限を必要とします。これは、ローカルで編集したコードをGASプロジェクトにアップロードしたり、逆にダウンロードしたりするために必要な権限です。

権限を承認すると、認証情報がローカルに保存されます。具体的には、ホームディレクトリに`.clasprc.json`というファイルが作成され、そこにアクセストークンが保存されます。このファイルは、claspが今後Googleのサービスと通信する際に使用されます。

重要な注意点として、この`.clasprc.json`ファイルは、絶対にGitリポジトリにコミットしてはいけません。このファイルには、あなたのGoogleアカウントにアクセスするための認証情報が含まれているため、外部に漏れると、他人があなたのアカウントでスクリプトを操作できてしまいます。通常、このファイルはユーザーのホームディレクトリに保存されるため、プロジェクトのディレクトリ内には作られませんが、念のため、プロジェクトの.gitignoreに`.clasprc.json`を追加しておくことをおすすめします。

認証が完了すると、ターミナルに成功メッセージが表示されます。「Authorization successful.」のようなメッセージが出れば、claspがあなたのGoogleアカウントと連携できる状態になったということです。この状態で、次のステップに進むことができます。

## ステップ4：既存のGASプロジェクトをクローンする

あなたは既にcleanup-scheduler.gsというGASスクリプトを持っているため、そのプロジェクトをローカルにクローンします。これにより、既存のスクリプトとローカルの開発環境が連携します。

まず、Google Apps Scriptのエディタで、あなたのcleanup-schedulerプロジェクトを開いてください。ブラウザでhttps://script.google.comにアクセスし、該当するプロジェクトを見つけて開きます。

次に、左側のメニューから「プロジェクトの設定」（歯車のアイコン）をクリックします。そこに「スクリプトID」という項目があるので、その文字列をコピーしてください。スクリプトIDは、「1abc2def3ghi...」のような長い英数字の文字列で、あなたのGASプロジェクトを一意に識別するためのものです。

スクリプトIDをコピーしたら、ターミナルに戻り、プロジェクトのルートディレクトリで以下のコマンドを実行します。

```bash
cd apps-script
pnpm exec clasp clone YOUR_SCRIPT_ID
```

ここで、`YOUR_SCRIPT_ID`の部分を、先ほどコピーしたスクリプトIDに置き換えてください。たとえば、スクリプトIDが「1abc2def3ghi4jkl5mno6pqr7stu8vwx9yzA」なら、`pnpm exec clasp clone 1abc2def3ghi4jkl5mno6pqr7stu8vwx9yzA`というコマンドになります。

このコマンドが何をするのか説明しましょう。`cd apps-script`で、apps-scriptディレクトリに移動します。これから作成する設定ファイルや、ダウンロードされるスクリプトファイルは、全てこのディレクトリ内に配置されます。

`pnpm exec clasp clone`は、指定したスクリプトIDのGASプロジェクトから、ファイルをダウンロードしてきます。claspは、GASプロジェクトに含まれる全てのスクリプトファイル（.gsファイル）とマニフェストファイル（appsscript.json）をダウンロードし、ローカルのディレクトリに保存します。

コマンドを実行すると、apps-scriptディレクトリ内に、いくつかのファイルが作成されます。まず、`.clasp.json`というファイルが作られます。これは、claspの設定ファイルで、どのGASプロジェクトと連携するのかが記録されています。中身を見ると、`"scriptId": "YOUR_SCRIPT_ID"`というような行があり、あなたのスクリプトIDが記録されています。

次に、既存のGASプロジェクトに含まれていたスクリプトファイルがダウンロードされます。あなたの場合は、cleanup-scheduler.gsというファイルがダウンロードされるはずです。このファイルは、GASのオンラインエディタで書かれたコードそのものです。

また、appsscript.jsonというファイルもダウンロードされます。これは、GASプロジェクトのマニフェストファイルで、プロジェクトの設定（タイムゾーン、ランタイムバージョン、必要な権限など）が記録されています。このファイルは、GASプロジェクトを正しく動作させるために必要な情報を含んでいます。

クローンが完了すると、ローカルのapps-scriptディレクトリとGASプロジェクトが連携した状態になります。これで、ローカルでコードを編集し、claspを使ってGASプロジェクトにアップロードできるようになります。

## ステップ5：GAS専用のTypeScript設定を作成する

apps-scriptディレクトリ内に、GAS専用のTypeScript設定ファイルを作成します。この設定ファイルは、GASのランタイム環境に合わせた特別な設定を含んでいます。あなたのプロジェクトのtoolsディレクトリでは、DenoがTypeScriptを直接実行するため、TypeScriptの設定ファイルは不要でした。しかし、GASのビルドでは、特定の設定でTypeScriptをJavaScriptにコンパイルする必要があります。

apps-scriptディレクトリ内に、`tsconfig.json`という名前のファイルを作成し、以下の内容を記述してください。

```jsonc
{
  "compilerOptions": {
    // GASのV8ランタイムはES2019の機能をサポートしているため、
    // コンパイルのターゲットをES2019に設定します
    // これにより、アロー関数、async/await、オプショナルチェーニングなど、
    // モダンなJavaScript構文が使用できます
    "target": "ES2019",
    
    // GASはモジュールシステム（import/export）をサポートしていないため、
    // モジュールを使用しない設定にします
    // 全てのコードは同じグローバルスコープに配置されます
    "module": "None",
    
    // ソースマップは、デバッグ時にTypeScriptのコードとJavaScriptのコードを
    // 対応付けるためのファイルですが、GASでは使用しないため生成しません
    "sourceMap": false,
    
    // コンパイルされたJavaScriptファイルの出力先ディレクトリを指定します
    // claspは、このディレクトリ内のファイルをGASプロジェクトにアップロードします
    "outDir": "./dist",
    
    // TypeScriptのソースコードがあるディレクトリを指定します
    // これから作成するsrcディレクトリを指定します
    "rootDir": "./src",
    
    // 厳密な型チェックを有効にします
    // これにより、潜在的なバグを早期に発見できます
    "strict": true,
    
    // 使用されていないローカル変数があると、コンパイルエラーになります
    // これにより、不要なコードを削除し、コードをクリーンに保てます
    "noUnusedLocals": true,
    
    // 使用されていない関数のパラメータがあると、コンパイルエラーになります
    // 意図的に使わないパラメータには、アンダースコアで始まる名前を付けることで
    // このチェックを回避できます（例: _unusedParam）
    "noUnusedParameters": true,
    
    // 関数の全ての実行パスがreturn文を含んでいることをチェックします
    // これにより、戻り値を返し忘れるバグを防げます
    "noImplicitReturns": true,
    
    // 到達不可能なコード（実行されることがないコード）があると、
    // コンパイルエラーになります
    "noUnreachableCode": true,
    
    // GASのAPIの型定義を読み込みます
    // これにより、DriveApp、SpreadsheetApp、MailAppなどのGAS固有のAPIに対して、
    // TypeScriptが正しく型チェックを行い、IDEで補完が効くようになります
    "types": ["google-apps-script"]
  },
  
  // コンパイル対象のファイルを指定します
  // srcディレクトリ内の全てのTypeScriptファイルがコンパイル対象になります
  "include": ["src/**/*"],
  
  // コンパイル対象外のファイルを指定します
  // node_modulesとdistは、コンパイル対象から除外します
  // また、テストファイル（.test.tsや.spec.ts）も除外します
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

この設定ファイルの各項目について、もう少し詳しく説明しましょう。

まず、`target: "ES2019"`という設定は非常に重要です。GASは、2020年にV8ランタイムを採用し、ES2019の機能をサポートするようになりました。それ以前は、古いRhinoランタイムを使用していて、ES5の機能しか使えませんでした。ES2019をターゲットにすることで、アロー関数、const/let、async/await、オプショナルチェーニング（`?.`）、Null合体演算子（`??`）など、モダンなJavaScript構文が使えます。これにより、コードがより読みやすく、書きやすくなります。

次に、`module: "None"`という設定も重要です。通常のNode.jsやブラウザ環境では、import/exportを使ってモジュールを分割できますが、GASはモジュールシステムをサポートしていません。全てのコードは、同じグローバルスコープに配置されます。つまり、複数のファイルに分割しても、最終的には全てのコードが一つの名前空間に統合されます。そのため、変数名や関数名の衝突に注意する必要があります。

`strict: true`の設定は、TypeScriptの型チェックを厳密にします。これにより、null/undefinedの扱いが厳密になったり、暗黙の型変換が禁止されたりします。最初は少し面倒に感じるかもしれませんが、実行時のエラーを大幅に減らせるため、強く推奨されます。

`noUnusedLocals`と`noUnusedParameters`の設定は、不要なコードを検出するのに役立ちます。使われていない変数や引数があると、コンパイルエラーになります。これにより、コードベースをクリーンに保つことができます。

`types: ["google-apps-script"]`の設定により、先ほどインストールした`@types/google-apps-script`パッケージの型定義が読み込まれます。これがないと、TypeScriptはDriveAppやSpreadsheetAppなどのGAS固有のAPIを認識できず、エラーを出してしまいます。

このtsconfig.jsonは、apps-scriptディレクトリ専用の設定です。toolsディレクトリのTypeScriptコードには影響しません。toolsディレクトリのコードは、Denoが直接実行するため、この設定ファイルは使用されません。これにより、GASとツールのそれぞれに最適な設定を使用できます。

## ステップ6：既存のBiome設定を活用する

あなたのプロジェクトには、既にbiome.jsoncという設定ファイルがあり、プロジェクト全体のlintとフォーマットのルールが定義されています。apps-script内のTypeScriptファイルも、この既存の設定を活用します。新しく設定ファイルを作る必要はありません。

ただし、既存のbiome.jsoncが、apps-scriptディレクトリを対象に含めているかどうかを確認する必要があります。ターミナルで以下のコマンドを実行して、biome.jsoncの内容を確認してください。

```bash
cat biome.jsonc
```

もしくは、エディタでbiome.jsoncを開いて、内容を確認します。特に、`files`セクションの`include`パターンを見てください。もし、特定のディレクトリだけを対象にしている設定があり、apps-scriptディレクトリが含まれていない場合は、追加する必要があります。

たとえば、もしbiome.jsoncに以下のような設定があったとします。

```jsonc
{
  "files": {
    "include": ["tools/**/*.ts", "tests/**/*.ts", "types/**/*.ts"]
  }
}
```

この場合、apps-script内のTypeScriptファイルは対象に含まれていません。この設定を以下のように修正して、apps-scriptディレクトリも含めます。

```jsonc
{
  "files": {
    "include": [
      "tools/**/*.ts",
      "tests/**/*.ts", 
      "types/**/*.ts",
      "apps-script/src/**/*.ts"
    ]
  }
}
```

もし、`include`パターンが指定されておらず、プロジェクト全体が対象になっている場合は、何も変更する必要はありません。Biomeは、デフォルトでプロジェクト内の全てのJavaScriptとTypeScriptファイルを対象にします。

Biomeの設定を一箇所に統一することの利点は、プロジェクト全体でコーディングスタイルが統一されることです。apps-script内のTypeScriptファイルも、toolsディレクトリのTypeScriptファイルも、同じlintルールとフォーマットルールが適用されます。これにより、どのファイルを開いても、一貫したスタイルでコードが書かれており、読みやすくなります。

また、Biomeは非常に高速なため、プロジェクト全体のlintとフォーマットを実行しても、数秒で完了します。これにより、コミット前に全てのファイルをチェックする習慣を付けやすくなります。

既にpackage.jsonには、Biomeのlintとフォーマットのためのスクリプトコマンドが定義されているはずです。`pnpm run lint`でlintを実行し、`pnpm run lint:fix`で自動修正を実行できます。これらのコマンドは、apps-script内のファイルにも適用されます。

## ステップ7：テスト環境について

あなたのプロジェクトでは、既にDenoの組み込みテストランナーを使用してテストを実行しています。deno.jsonの`test`タスクを見ると、`deno test`コマンドが定義されています。このテストシステムは、toolsディレクトリのスクリプトをテストするために使用されています。

GASのコードに対するテストも、このDenoのテストシステムを使用することができます。ただし、重要な注意点があります。GAS固有のAPI（DriveApp、SpreadsheetApp、MailAppなど）は、Deno環境では実行できません。これらのAPIは、Googleのサーバー上でのみ利用可能です。

そのため、テスト戦略は以下のようになります。まず、ビジネスロジック部分（日付計算、フィルタリング、データ変換など）は、GAS固有のAPIに依存しない純粋なTypeScript関数として実装します。これらの関数は、Denoのテスト環境でユニットテストを書くことができます。

たとえば、あなたのcleanup-scheduler.tsには、`filterOldFolders`という関数があります。この関数は、フォルダ情報の配列を受け取り、指定した日数より古いフォルダだけをフィルタリングして返します。この関数は、GAS固有のAPIを使用していないため、Denoでテストできます。

```typescript
// テスト可能な純粋な関数の例
function filterOldFolders(folders: EventFolderInfo[], retentionDays: number): EventFolderInfo[] {
  return folders.filter((folder) => folder.daysOld > retentionDays);
}
```

このような関数に対しては、testsディレクトリにテストファイル（たとえば、`gas-cleanup-scheduler.test.ts`）を作成し、Denoのテスト構文を使ってテストを書きます。

```typescript
import { assertEquals } from "jsr:@std/assert";

Deno.test("filterOldFolders filters folders older than retention days", () => {
  const folders = [
    new EventFolderInfo("1", "folder1", new Date("2024-12-01"), 10),
    new EventFolderInfo("2", "folder2", new Date("2024-11-01"), 40),
    new EventFolderInfo("3", "folder3", new Date("2024-12-10"), 25),
  ];

  const result = filterOldFolders(folders, 30);

  assertEquals(result.length, 1);
  assertEquals(result[0].name, "folder2");
});
```

一方、GAS固有のAPIを使用する部分（DriveAppでフォルダを取得する、SpreadsheetAppでログを記録する、MailAppでメールを送信するなど）は、ユニットテストで完全にカバーすることは困難です。これらの部分については、以下のアプローチを取ることができます。

まず、モック（偽のオブジェクト）を作成して、GAS APIの動作をシミュレートする方法があります。ただし、これは手間がかかり、テストコードが複雑になる傾向があります。次に、GASの実行環境で手動テストを行う方法があります。実際にGASプロジェクトにデプロイして、トリガーを設定し、動作を確認します。そして、重要なロジック部分だけをテストし、API統合部分は手動テストに任せるという、実用的なアプローチもあります。

あなたのプロジェクトでは、三つ目のアプローチが最も現実的でしょう。ビジネスロジックの関数は、Denoのテストでカバーし、GAS APIとの統合部分は、実際のGAS環境で動作確認を行います。これにより、重要な部分の品質を保ちながら、テストの複雑さを抑えることができます。

既存のdeno.jsonの`test`タスクを実行すると、testsディレクトリ内の全てのテストファイルが実行されます。GASのロジックに対するテストファイルを追加しても、同じコマンドでまとめてテストできます。

```bash
deno task test
```

このコマンドは、toolsディレクトリのテストも、GASのロジックのテストも、全て実行します。テストが成功すれば、あなたのコードが期待通りに動作していることが確認できます。

## ステップ8：claspの設定を調整する

claspが生成した`.clasp.json`ファイルを編集し、TypeScriptのコンパイル先ディレクトリを参照するように設定します。これにより、claspは、コンパイル済みのJavaScriptファイルをGASプロジェクトにアップロードするようになります。

apps-scriptディレクトリ内の`.clasp.json`ファイルをエディタで開いてください。現在、この ファイルには、スクリプトIDだけが記録されているはずです。

```json
{
  "scriptId": "YOUR_SCRIPT_ID"
}
```

このファイルに、`rootDir`という設定を追加します。これは、claspがどのディレクトリのファイルをアップロードするかを指定する設定です。以下のように編集してください。

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "./dist"
}
```

この設定により、claspは`dist/`ディレクトリ内のファイルを見て、その中のJavaScriptファイルとappsscript.jsonをGASプロジェクトにアップロードします。`src/`ディレクトリ内のTypeScriptファイルは直接アップロードされず、必ずTypeScriptコンパイラでJavaScriptに変換された後、`dist/`に出力されたファイルがアップロードされます。

なぜこのような設定にするのか、理由を説明しましょう。GASは、JavaScriptしか実行できません。TypeScriptファイルを直接GASプロジェクトにアップロードしても、実行できません。そのため、TypeScriptをJavaScriptに変換する必要があります。

TypeScriptのコンパイラ（tsc）は、`src/`ディレクトリ内のTypeScriptファイルを読み取り、`dist/`ディレクトリにJavaScriptファイルを出力します。この出力先は、先ほど作成したtsconfig.jsonの`outDir`設定で指定しました。

そして、claspは、`dist/`ディレクトリ内のファイルを見て、GASプロジェクトにアップロードします。この流れにより、TypeScriptで開発しながら、最終的にはJavaScriptとしてGASで実行されるという、正しいビルドプロセスが確立されます。

もし`rootDir`を指定しなかった場合、claspはapps-scriptディレクトリ直下の全てのファイルをアップロードしようとします。そうすると、TypeScriptファイル（.ts）、設定ファイル（tsconfig.json）、その他の開発用ファイルまで、全てGASプロジェクトにアップロードされてしまいます。これは望ましくありません。GASプロジェクトには、実行に必要なJavaScriptファイルとマニフェストファイルだけがあるべきです。

`rootDir`を`./dist`に設定することで、claspは`dist/`ディレクトリ内だけを見るようになり、余計なファイルがアップロードされることを防げます。これにより、GASプロジェクトがクリーンに保たれ、管理しやすくなります。

## ステップ9：.claspignoreファイルの作成

claspがアップロードするファイルを制御するために、`.claspignore`ファイルを作成します。このファイルは、Gitの`.gitignore`と同じような役割を持ちます。特定のファイルやディレクトリを指定することで、それらがGASプロジェクトにアップロードされないようにできます。

apps-scriptディレクトリ内に、`.claspignore`という名前のファイルを作成し、以下の内容を記述してください。

```
# 全てのファイルを一旦無視
**/**

# 以下のファイルのみアップロード対象とする
!dist/**/*.js
!dist/appsscript.json

# ただし、テストファイルは除外
dist/**/*.test.js
dist/**/*.spec.js
```

この設定ファイルの各行の意味を説明しましょう。最初の`**/**`は、全てのファイルとディレクトリを無視するというパターンです。これにより、デフォルトでは何もアップロードされません。

次の`!dist/**/*.js`は、`dist/`ディレクトリ内の全てのJavaScriptファイルをアップロード対象に含めるという意味です。`!`マークは、前の無視設定を上書きして、このパターンにマッチするファイルを含めることを意味します。

`!dist/appsscript.json`は、GASのマニフェストファイルをアップロード対象に含めます。このファイルは、GASプロジェクトの動作に必要な設定情報を含んでいるため、必ずアップロードする必要があります。

最後の`dist/**/*.test.js`と`dist/**/*.spec.js`は、テストファイルを除外します。もしTypeScriptのテストファイルがコンパイルされて`dist/`に出力された場合でも、これらはGASで実行する必要がないため、アップロードから除外します。

この設定により、claspは、コンパイル済みのJavaScriptファイルとマニフェストファイルのみをGASプロジェクトにアップロードします。TypeScriptのソースコード、設定ファイル、READMEなどの開発用ファイルは、ローカルにのみ存在し、GASプロジェクトには含まれません。

これは、GASプロジェクトをクリーンに保つために重要です。開発用のファイルがGASプロジェクトに混入すると、管理が煩雑になり、また、不要なファイルがGASのクォータ（容量制限）を消費することにもなります。

## ステップ10：ディレクトリ構造の整理

これまでの設定を踏まえて、apps-scriptディレクトリ内に、適切なディレクトリ構造を作成します。ターミナルで以下のコマンドを実行してください。

```bash
cd apps-script
mkdir src
```

この`src/`ディレクトリが、TypeScriptのソースコードを配置する場所です。これから、既存のcleanup-scheduler.gsファイルを、このディレクトリ内にTypeScriptファイルとして移動し、型アノテーションを追加していきます。

最終的なapps-scriptディレクトリの構造は、以下のようになります。

```
apps-script/
├── src/                           # TypeScriptのソースコード
│   └── cleanup-scheduler.ts       # クリーンアップスクリプト（TypeScript版）
├── dist/                          # TypeScriptのコンパイル先（自動生成）
│   ├── cleanup-scheduler.js       # コンパイル済みのJavaScript
│   └── appsscript.json            # GASのマニフェストファイル
├── .clasp.json                    # claspの設定
├── .claspignore                   # claspの無視ファイル設定
├── tsconfig.json                  # TypeScriptの設定
├── cleanup-scheduler.gs           # 元のGASスクリプト（バックアップ）
└── README.md                      # ドキュメント
```

`dist/`ディレクトリは、TypeScriptをコンパイルしたときに自動的に作成されるため、手動で作成する必要はありません。最初のコンパイル時に、TypeScriptコンパイラが自動的にこのディレクトリを作成し、JavaScriptファイルを出力します。

元のcleanup-scheduler.gsファイルは、バックアップとして残しておきます。TypeScript版に完全に移行し、動作確認が終わったら、削除しても構いません。ただし、元のコードを参照したい場合に備えて、しばらくは残しておくことをおすすめします。

appsscript.jsonファイルは、現在apps-scriptディレクトリ直下にあるはずですが、これは`dist/`ディレクトリにコピーする必要があります。TypeScriptをコンパイルする際に、このファイルも一緒に`dist/`にコピーすることで、claspが正しくアップロードできるようになります。この手順については、後のステップで説明します。

## ステップ11：package.jsonにGAS関連のスクリプトを追加する

トップレベルのpackage.jsonに、GAS開発のためのスクリプトコマンドを追加します。これにより、`pnpm run`コマンドで、TypeScriptのコンパイル、claspでのアップロード、その他のGAS関連タスクを簡単に実行できるようになります。

package.jsonをエディタで開き、`"scripts"`セクションを以下のように編集してください。既存の`lint`と`lint:fix`コマンドは残したまま、新しいコマンドを追加します。

```json
{
  "name": "photo-management",
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --fix .",
    "gas:build": "cd apps-script && tsc",
    "gas:watch": "cd apps-script && tsc --watch",
    "gas:push": "cd apps-script && pnpm exec clasp push",
    "gas:open": "cd apps-script && pnpm exec clasp open",
    "gas:deploy": "pnpm run lint && pnpm run gas:build && pnpm run gas:push"
  },
  "license": "MIT",
  "packageManager": "pnpm@10.14.0",
  "devDependencies": {
    "@biomejs/biome": "2.2.6",
    "@google/clasp": "^2.4.2",
    "@types/google-apps-script": "^1.0.83",
    "typescript": "^5.7.2"
  }
}
```

各スクリプトコマンドの役割を説明します。まず、`gas:build`は、TypeScriptをJavaScriptにコンパイルします。`cd apps-script`でapps-scriptディレクトリに移動してから、`tsc`コマンドでTypeScriptコンパイラを実行します。これにより、`src/`内のTypeScriptファイルが`dist/`にJavaScriptとしてコンパイルされます。

次に、`gas:watch`は、ファイルの変更を監視し、自動的に再コンパイルします。開発中は、このコマンドを実行しておくと、TypeScriptファイルを保存するたびに自動的にコンパイルされるため、開発効率が向上します。

`gas:push`は、claspを使って、`dist/`内のファイルをGASプロジェクトにアップロードします。ビルドが完了した後に、このコマンドを実行することで、ローカルの変更をGASプロジェクトに反映できます。

`gas:open`は、ブラウザでGASのオンラインエディタを開きます。アップロード後に、コードを確認したり、トリガーを設定したりするときに便利です。

`gas:deploy`は、lint、ビルド、プッシュを一度に実行します。本番環境にデプロイする前に、このコマンドを実行することで、コードの品質をチェックし、ビルドし、GASプロジェクトにアップロードするという一連の流れを自動化できます。

注意点として、これらのスクリプトは全て`pnpm run`コマンドで実行します。たとえば、TypeScriptをコンパイルするには、`pnpm run gas:build`と入力します。これにより、package.jsonに定義されたコマンドが実行されます。

また、これらのGAS関連のスクリプトは、deno.jsonのタスクとは別に管理されます。Denoのタスクは、toolsディレクトリのスクリプトを実行するためのもので、GASのビルドとは関係ありません。この分離により、それぞれのツールチェーンが独立して動作し、混乱を避けられます。

## ステップ12：既存スクリプトをTypeScript化する

既存のcleanup-scheduler.gsファイルを、TypeScriptファイルに変換します。まず、ファイルを`src/`ディレクトリにコピーし、拡張子を.tsに変更します。

```bash
cd apps-script
cp cleanup-scheduler.gs src/cleanup-scheduler.ts
```

次に、エディタで`src/cleanup-scheduler.ts`を開き、TypeScriptの型アノテーションを追加していきます。既存のコードは、ほとんどそのまま使えますが、変数、関数の引数、関数の戻り値に型を明示することで、TypeScriptの恩恵を受けられます。

主要な変更点を説明します。まず、設定値の型を明示します。

```typescript
const PHOTO_DISTRIBUTION_FOLDER_ID: string = 'YOUR_FOLDER_ID_HERE';
const RETENTION_DAYS: number = 30;
const NOTIFICATION_EMAIL: string = 'your-email@example.com';
const LOG_SPREADSHEET_ID: string = '';
```

これにより、これらの変数に誤った型の値を代入しようとすると、TypeScriptがコンパイル時にエラーを出してくれます。

次に、EventFolderInfoクラスにプロパティの型を明示します。

```typescript
class EventFolderInfo {
  id: string;
  name: string;
  createdTime: Date;
  daysOld: number;

  constructor(id: string, name: string, createdTime: Date, daysOld: number) {
    this.id = id;
    this.name = name;
    this.createdTime = createdTime;
    this.daysOld = daysOld;
  }
}
```

関数にも、引数と戻り値の型を明示します。

```typescript
function listEventFolders(): EventFolderInfo[] {
  const parentFolder = DriveApp.getFolderById(PHOTO_DISTRIBUTION_FOLDER_ID);
  const folders = parentFolder.getFolders();
  const now = new Date();
  const result: EventFolderInfo[] = [];

  while (folders.hasNext()) {
    const folder = folders.next();
    const createdTime = folder.getDateCreated();
    const daysOld = Math.floor((now.getTime() - createdTime.getTime()) / (1000 * 60 * 60 * 24));

    result.push(new EventFolderInfo(folder.getId(), folder.getName(), createdTime, daysOld));
  }

  return result;
}

function filterOldFolders(folders: EventFolderInfo[], retentionDays: number): EventFolderInfo[] {
  return folders.filter((folder) => folder.daysOld > retentionDays);
}

function deleteFolder(folderInfo: EventFolderInfo): boolean {
  try {
    const folder = DriveApp.getFolderById(folderInfo.id);
    folder.setTrashed(true);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.log(`フォルダの削除に失敗: ${folderInfo.name} - ${errorMessage}`);
    return false;
  }
}
```

エラーハンドリングの部分では、`error`の型を`unknown`または`any`として扱い、`instanceof Error`でチェックしてから`.message`にアクセスすることで、型安全性を保ちます。

型を追加することで、IDEの補完が強力になり、typoや型の不一致によるバグを、実行前に発見できるようになります。また、コードの可読性も向上し、各変数や関数が何を扱っているのかが明確になります。

## ステップ13：appsscript.jsonをdistにコピーする

GASのマニフェストファイル（appsscript.json）は、GASプロジェクトの設定情報を含んでいます。このファイルは、TypeScriptのコンパイル時に`dist/`ディレクトリにコピーする必要があります。

最も簡単な方法は、apps-scriptディレクトリ直下にあるappsscript.jsonを、手動で`dist/`ディレクトリにコピーすることです。ただし、この方法だと、ビルドするたびに手動でコピーする必要があります。

より良い方法は、package.jsonのビルドスクリプトを修正して、appsscript.jsonを自動的にコピーするようにすることです。以下のように、`gas:build`スクリプトを修正します。

```json
"gas:build": "cd apps-script && tsc && cp appsscript.json dist/"
```

このコマンドは、TypeScriptをコンパイルした後、appsscript.jsonを`dist/`ディレクトリにコピーします。これにより、`pnpm run gas:build`を実行するだけで、JavaScriptファイルとマニフェストファイルの両方が`dist/`に揃います。

もし、appsscript.jsonが存在しない場合は、新しく作成する必要があります。apps-scriptディレクトリ内に、以下の内容で`appsscript.json`ファイルを作成してください。

```json
{
  "timeZone": "Asia/Tokyo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

このマニフェストファイルは、GASプロジェクトがV8ランタイムを使用し、タイムゾーンが日本時間であることを指定しています。また、エラーログがStackdriver（Google Cloud Logging）に記録されるように設定しています。

## ステップ14：開発ワークフロー

実際の開発では、以下のようなワークフローで作業を進めます。このワークフローを理解しておくと、日々の開発がスムーズに進みます。

まず、開発を始める際には、ターミナルを二つ開きます。一つ目のターミナルでは、TypeScriptの自動コンパイルを有効にします。

```bash
pnpm run gas:watch
```

このコマンドを実行すると、TypeScriptコンパイラがwatchモードで起動し、ファイルの変更を監視し続けます。`src/cleanup-scheduler.ts`を編集して保存するたびに、自動的にTypeScriptがコンパイルされ、`dist/cleanup-scheduler.js`が更新されます。この自動コンパイルにより、ビルドのことを気にせずにコードを書くことに集中できます。

二つ目のターミナルでは、必要に応じてテストを実行したり、claspでアップロードしたりします。

コードを書いている最中は、一つ目のターミナルでwatchモードを動かしたまま、エディタでTypeScriptファイルを編集します。保存すると、ターミナルにコンパイル結果が表示されます。もしTypeScriptのエラーがあれば、このタイミングで気付けるため、すぐに修正できます。

一区切りついたら、コードの品質をチェックします。

```bash
pnpm run lint
```

このコマンドは、Biomeでlintを実行し、コードスタイルや潜在的な問題をチェックします。問題があれば、ターミナルに表示されます。自動修正可能な問題は、`pnpm run lint:fix`で修正できます。

コードが完成したら、GASプロジェクトにアップロードします。

```bash
pnpm run gas:push
```

このコマンドは、`dist/`内のファイルをGASプロジェクトにアップロードします。アップロードが完了すると、GASのオンラインエディタで確認できます。オンラインエディタを開くには、以下のコマンドを使います。

```bash
pnpm run gas:open
```

ブラウザが開き、GASのオンラインエディタが表示されます。アップロードされたコードを確認し、必要に応じてトリガーを設定したり、手動で実行したりします。

本番環境にデプロイする前には、全てのチェックを一度に実行します。

```bash
pnpm run gas:deploy
```

このコマンドは、lint、ビルド、プッシュを順番に実行します。全てが成功すれば、コードは本番環境にデプロイする準備ができています。

Denoのツールとの使い分けについても説明しておきます。写真配布の自動化ツール（イベントの初期化、アーカイブの作成、アップロードなど）は、`deno task`コマンドで実行します。たとえば、`deno task init`でイベントを初期化し、`deno task ship`で一連のワークフローを実行します。

一方、GASのビルドとデプロイは、`pnpm run`コマンドで実行します。これらは、別々のツールチェーンとして管理されており、互いに干渉しません。Denoのツールは、ローカルで実行されるスクリプトで、GASのスクリプトは、Googleのサーバーで実行されます。それぞれが、適切な役割を担っています。

## ステップ15：Gitによるバージョン管理の注意点

既にあなたのプロジェクトはGitで管理されていると思いますが、GAS開発環境を追加したことで、いくつか`.gitignore`に追加すべき項目があります。

プロジェクトのルートディレクトリの`.gitignore`ファイルに、以下の項目を追加してください。

```gitignore
# apps-script関連
apps-script/dist/
apps-script/node_modules/

# claspの認証情報（絶対に公開してはいけません）
.clasprc.json
```

特に重要なのは、`.clasprc.json`を`.gitignore`に含めることです。このファイルには、Googleアカウントの認証情報が含まれているため、絶対にGitリポジトリにコミットしてはいけません。もしリポジトリに含めてしまうと、リポジトリにアクセスできる人全員が、あなたのGoogleアカウントでスクリプトを操作できてしまいます。

`apps-script/dist/`ディレクトリも、`.gitignore`に含めます。これは、TypeScriptのコンパイル結果であり、ソースコードから自動生成されるファイルです。Gitでは、ソースコード（`src/`内のTypeScriptファイル）だけを管理し、コンパイル結果は管理しません。これにより、差分が見やすくなり、マージコンフリクトも起こりにくくなります。

`apps-script/node_modules/`も、念のため追加しておきます。ただし、あなたのプロジェクトでは、パッケージはトップレベルのnode_modulesにインストールされるため、この項目は実際には使われないかもしれません。

既存の`.gitignore`に、既にnode_modulesや.clasprc.jsonが含まれている可能性もあります。その場合は、重複して追加する必要はありません。

GASのスクリプトを変更した後は、以下のようなコミットメッセージでコミットします。

```bash
git add apps-script/src/
git commit -m "feat(gas): Add folder cleanup logic with error handling"
```

ソースコード（`src/`内のファイル）と設定ファイル（tsconfig.json、.clasp.json、.claspignoreなど）だけをコミットし、`dist/`内のファイルはコミットしません。これにより、Gitの履歴がクリーンに保たれます。

## まとめ

これで、Denoベースのプロジェクトに、GAS開発環境を統合することができました。この環境では、以下のメリットが得られます。

まず、TypeScriptによる型安全性です。変数や関数に型を明示することで、実行前にバグを検出でき、IDEの補完機能も強化されます。コードの可読性も向上し、各関数が何を受け取り、何を返すのかが明確になります。

次に、既存のBiomeによる統一されたコーディングスタイルです。apps-script内のコードも、toolsディレクトリのコードも、同じlintとフォーマットのルールが適用されます。これにより、プロジェクト全体でコードスタイルが統一され、読みやすくなります。

claspによるローカル開発の快適さも重要です。好きなエディタでコードを書き、Gitでバージョン管理でき、チームでの協業も容易になります。オンラインエディタでの開発に比べて、開発効率が大幅に向上します。

そして、DenoとNode.jsのツールチェーンの明確な分離です。Denoのツールは、ローカルで実行される自動化スクリプトに使用し、Node.jsのツールは、GASのビルドとデプロイに使用します。この分離により、それぞれのツールが最適な役割を果たし、混乱を避けられます。

重要なビジネスロジック部分は、Denoのテストでカバーでき、GAS APIとの統合部分は、実際のGAS環境で動作確認を行います。これにより、重要な部分の品質を保ちながら、テストの複雑さを抑えることができます。

この環境を活用して、快適なGAS開発を楽しんでください。質問や問題があれば、いつでも聞いてください。
