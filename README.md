# Google Chat Filter テストシステム

このプロジェクトは、システムから発生したメッセージを Webhook 経由で Google Chat と Slack に送り、内容によって投稿先チャネルを自動で振り分けるテスト用サンプルです。

---

## 構成

- Node.js: Webhook サーバー（メッセージ受信＆Google Apps Script Bot へ転送）
- Google Apps Script: Google Chat Bot（受信した内容でチャネルを振り分けて投稿）
- Google Spreadsheet: フィルタールールの管理
- Slack: 通知用チャネル

---

## 0. チャットサービスの設定

### 0-1. Google Chat のチャネル（スペース）作成方法

※ Google Workspace の有料ユーザーのみ利用可能

1. Google Chat（https://chat.google.com/）にアクセスします。
2. 左側の「＋」ボタンや「スペースを探す」から「スペースを作成」を選択します。
3. スペース名（例：エラー通知、通常通知）を入力し、必要に応じて説明やメンバーを追加します。
4. 「作成」をクリックします。
5. 作成したスペースを開き、右上の「スペースの管理」や「アプリと連携」から「Webhook を追加」し、Webhook URL を発行します。
6. 発行した Webhook URL をスプレッドシートの「チャネル設定」シートに設定してください。

### 0-2. Slack のチャネル設定方法

1. Slack ワークスペースにログインします。
2. 通知を送信したいチャネルを作成または選択します。
3. チャネル名の横の「...」をクリックし、「チャネルの詳細を表示」を選択します。
4. 「アプリを追加する」をクリックします。
5. 検索バーで「Incoming Webhooks」を検索し、インストールします。
6. 「Incoming Webhooks を追加」をクリックします。
7. 「Webhook URL の追加」をクリックし、チャネルを選択します。
8. 生成された Webhook URL をコピーし、スプレッドシートの「チャネル設定」シートに設定します。

---

## 1. Node.js サーバーのセットアップ

### 1-1. 必要なパッケージのインストール

```bash
npm install
```

### 1-2. .env ファイルの作成

プロジェクトルートに`.env`ファイルを作成し、以下の内容を記載してください。

```
BOT_WEBHOOK_URL="<GASのデプロイURL>"
PORT=3000
```

- `BOT_WEBHOOK_URL` : Google Apps Script のデプロイ URL

### 1-3. サーバーの起動

```bash
npm start
```

サーバーが起動したら、ブラウザで `http://localhost:3000` にアクセスして、Web ページからメッセージを送信できます。

### 1-4. Web インターフェース

![](https://storage.googleapis.com/zenn-user-upload/6ada248f2eb2-20250607.png)

Web インターフェースでは以下の機能が利用できます：

1. メッセージ送信パネル

   - メッセージ入力欄
   - 送信ボタン
   - クリアボタン
   - 接続状態インジケーター

2. ログ表示パネル

   - リアルタイムログ表示
   - ログクリアボタン
   - カラーコーディングされたログエントリ
   - 詳細情報の展開表示

3. 使いやすい機能
   - Enter キーで送信（Shift+Enter で改行）
   - WebSocket 自動再接続
   - エラー表示の改善

### 1-5. サーバー側のログ出力

サーバー側では以下のような形式でログが出力されます：

```
[起動] サーバーが起動しました: http://localhost:3000

[リクエスト] メッセージを受信
- タイムスタンプ: 2024-03-15 10:30:45
- リクエスト内容: {"text": "エラー: サーバーがダウンしました"}

[処理] メッセージの処理を開始
- テキスト: エラー: サーバーがダウンしました
- 送信先: GAS Bot (URL: https://script.google.com/macros/s/XXXX/exec)

[レスポンス] 処理結果
- ステータス: 成功
- レスポンス: {"success": true, "message": "送信成功"}

[エラー] メッセージ送信に失敗した場合
- ステータスコード: 404
- エラー内容: Request failed with status code 404
- 送信先: Google Chat
- Webhook URL: https://chat.googleapis.com/v1/spaces/XXXX/messages?key=XXXX&token=XXXX
- 送信内容: エラー: サーバーがダウンしました
- レスポンス: {"error":{"code":404,"message":"Not Found"}}
```

---

## 2. Google Apps Script（GAS）Bot の作成

### 2-1. スプレッドシートの準備

1. 新しい Google Spreadsheet を作成します。
2. スプレッドシート ID の取得方法：
   - スプレッドシートの URL を確認します
   - URL の形式: `https://docs.google.com/spreadsheets/d/【スプレッドシートID】/edit`
   - 例: `https://docs.google.com/spreadsheets/d/1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7/edit` の場合
   - スプレッドシート ID は `1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7` となります
3. 以下の 2 つのシートを作成します：
   - 「フィルター設定」シート
     - A 列: 正規表現パターン
     - B 列: チャネル ID
   - 「チャネル設定」シート
     - A 列: チャネル ID
     - B 列: Google Chat Webhook URL
     - C 列: Slack Webhook URL

### 2-2. 新規プロジェクト作成

1. [Google Apps Script](https://script.google.com/) にアクセスし、新しいプロジェクトを作成します。
2. プロジェクトの設定を開く：
   - メニューから「プロジェクトの設定」を選択
   - 「スクリプトプロパティ」タブを選択
   - 「行を追加」をクリック
   - プロパティ名: `SPREADSHEET_ID`
   - 値: あなたのスプレッドシート ID
3. `Code.gs` に以下のコードを貼り付けます。

https://github.com/long-910/GoogleChatFilter/blob/main/Code.gs

### 2-3. デプロイ

1. Google Apps Script エディタで「プロジェクトの設定」を開く
2. 「スクリプトプロパティ」タブを選択
3. 「行を追加」をクリック
4. 以下の設定を追加：
   - プロパティ名: `SPREADSHEET_ID`
   - 値: あなたのスプレッドシート ID
5. 「保存」をクリック

これにより：

- スプレッドシート ID をコードから分離
- 環境ごとに異なる設定が可能
- セキュリティの向上（ID がコードに直接記載されない）

### 2-4. Web アプリとしてデプロイ

1. メニューから「デプロイ」→「新しいデプロイ」
2. 「種類を選択」で「ウェブアプリ」
3. 「次のユーザーとして実行」→「自分」
4. 「アクセスできるユーザー」→「全員」
5. デプロイして、表示された URL を`.env`の`BOT_WEBHOOK_URL`に設定

### 2-5. 実行ログの確認方法

1. Google Apps Script エディタで「表示」→「ログ」を選択
2. または、エディタの下部にある「ログ」タブをクリック
3. ログには以下の情報が表示されます：
   - エラーメッセージ
   - デバッグ情報
   - 実行時間
   - リクエスト/レスポンスの内容

ログの例：

```
[20-03-15 10:30:45:123 JST] メッセージを受信: エラー: サーバーがダウンしました
[20-03-15 10:30:45:234 JST] チャネルを決定: error-channel
[20-03-15 10:30:45:345 JST] Google Chatへの送信に失敗しました: Request failed with status code 404
```

### 2-6. Web アプリのログ確認方法

1. Google Apps Script エディタで「デプロイ」→「デプロイを管理」を選択
2. 該当する Web アプリの「アクション」列の「...」をクリック
3. 「ログを表示」を選択
4. または、以下の URL に直接アクセス：
   ```
   https://script.google.com/home/executions
   ```

ログには以下の情報が表示されます：

- 実行日時
- 実行状態（成功/失敗）
- 実行時間
- トリガー（Web アプリの場合は「Web アプリ」）
- エラーメッセージ（失敗した場合）

エラーが発生した場合：

1. エラーメッセージを確認
2. 実行時間を確認（タイムアウトの可能性）
3. リクエストの内容を確認

### 2-7. 実行ログの詳細な確認方法

1. 実行ログの表示

   - 実行一覧から該当する実行をクリック
   - 「実行の詳細」パネルが表示される
   - 「ログを表示」をクリックして詳細なログを確認

2. ログの内容

   - 実行開始時刻
   - 実行終了時刻
   - 実行時間
   - 実行状態
   - エラーメッセージ（発生時）
   - リクエストパラメータ
   - レスポンス内容

3. エラーの場合

   - エラーメッセージをクリックして詳細を表示
   - スタックトレースを確認
   - エラーが発生した行番号を確認

4. ログの保存期間
   - 実行ログは 30 日間保存
   - 古いログは自動的に削除
   - 重要なログは手動でエクスポート可能

### 2-8. スプレッドシートの設定例

#### フィルター設定シート

| 正規表現パターン | チャネル ID    |
| ---------------- | -------------- |
| エラー.\*        | error-channel  |
| .\*              | normal-channel |

#### チャネル設定シート

| チャネル ID    | Google Chat Webhook URL                                                 | Slack Webhook URL                               |
| -------------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| error-channel  | https://chat.googleapis.com/v1/spaces/XXXX/messages?key=XXXX&token=XXXX | -                                               |
| normal-channel | -                                                                       | https://hooks.slack.com/services/AAAA/BBBB/CCCC |

※ Webhook URL に「-」を設定した場合、その通知はスキップされます。
上記の例では：

- エラーメッセージは Google Chat のみに通知
- 通常メッセージは Slack のみに通知

---

## 3. 使い方

### 3-1. Web ページからメッセージを送信

1. ブラウザで `http://localhost:3000` にアクセス
2. テキストエリアにメッセージを入力
3. 「送信」ボタンをクリック

メッセージは、スプレッドシートで設定した正規表現パターンに基づいて、適切なチャネルに振り分けられます：

- `エラー`を含むメッセージはエラー通知チャネルへ
- それ以外のメッセージは通常通知チャネルへ

各チャネルに対して、Google Chat と Slack の両方に通知が送信されます。

### 3-2. API からメッセージを送信

Web ページの代わりに、API を直接呼び出すこともできます：

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"text": "エラー: サーバーダウン"}'
```

---

## 補足

- Google Apps Script の無料枠ではリクエスト数に制限があります。
- Google Chat の Webhook URL や GAS のデプロイ URL は漏洩しないようご注意ください。
- スプレッドシートの設定を変更することで、フィルタールールを動的に更新できます。
- Google Chat の Webhook 機能は Google Workspace の有料ユーザーのみ利用可能です。
- Slack の Webhook は無料プランでも利用可能です。

### エラー対処方法

#### 404 エラー（Request failed with status code 404）が発生する場合

1. Google Chat Webhook URL の場合：

   - Google Workspace の有料ユーザーであることを確認
   - Webhook URL が正しく発行されているか確認
   - スペースの種類が「チャット」であることを確認
   - Webhook URL の有効期限が切れていないか確認

2. Slack Webhook URL の場合：

   - Webhook URL が正しく発行されているか確認
   - チャネルが存在するか確認
   - アプリの権限が正しく設定されているか確認

3. Google Apps Script の場合：
   - デプロイが正しく行われているか確認
   - デプロイ URL が正しいか確認
   - アクセス権限が「全員」に設定されているか確認

4. スプレッドシートの場合：
   - スプレッドシート ID が正しいか確認
   - スプレッドシートへのアクセス権限が正しく設定されているか確認

### 注意事項

- スプレッドシートの設定を変更することで、フィルタールールを動的に更新できます。
- Google Chat の Webhook 機能は Google Workspace の有料ユーザーのみ利用可能です。
- Slack の Webhook は無料プランでも利用可能です。

---

## ライセンス

MIT
