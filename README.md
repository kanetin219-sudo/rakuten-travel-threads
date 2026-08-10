# Rakuten Travel × Threads 自動投稿ボット

楽天トラベルの宿泊施設をリサーチし、Meta公式Threads APIを使って毎日自動投稿するNode.jsアプリケーションです。

## 機能

- 🏨 楽天トラベルAPIから日本の人気宿を自動取得
- 📊 口コミ評価・件数・画像の有無などでスコアリング
- 🔗 楽天アフィリエイトリンク付き投稿文を自動生成
- 📱 Meta公式Threads APIで毎日19時に自動投稿
- 🔄 30日間の重複投稿防止機能
- ⏰ タイムゾーン対応・カスタマイズ可能な投稿時間
- 🛡️ エラーハンドリング・リトライ機能搭載
- 📋 投稿ログ・投稿履歴の自動保存

## セットアップ

### 1. 必要なもの

- Node.js 20以上
- 楽天トラベルAPI認証情報（ApplicationID・アフィリエイトID）
- Meta Threads API認証情報（User ID・アクセストークン）

### 2. インストール

```bash
# クローン
git clone <repository>
cd rakuten-travel-threads

# 依存関係をインストール
npm install
```

### 3. 環境変数設定

```bash
# .env.example から .env を作成
cp .env.example .env

# .env をエディタで編集
nano .env
```

`.env` に以下を設定：

```env
RAKUTEN_APPLICATION_ID=xxx
RAKUTEN_AFFILIATE_ID=xxx
THREADS_USER_ID=xxx
THREADS_ACCESS_TOKEN=xxx
SEARCH_KEYWORDS=由布院,別府,福岡,熊本
TIMEZONE=Asia/Tokyo
POST_HOUR=19
```

## API認証情報の取得方法

### 楽天トラベル API

1. [楽天Webサービスのトップページ](https://webservice.rakuten.co.jp/)にアクセス
2. 楽天会員でログイン（なければ登録）
3. 「アプリを開発する」→ 新しいアプリを作成
4. 「楽天トラベル宿検索API」を利用申請
5. ApplicationID を取得

### 楽天アフィリエイト ID

1. [楽天アフィリエイト](https://affiliate.rakuten.co.jp/)にログイン
2. 管理画面 → アフィリエイトID を確認

### Meta Threads API

#### 1. Meta Business Account の準備

1. [Meta for Developers](https://developers.facebook.com/) にアクセス
2. Meta ビジネスアカウントで登録（なければ作成）
3. 「マイアプリ」→ 新しいアプリを作成

#### 2. Threads User ID の取得

```bash
# Graph API Explorで確認
https://developers.facebook.com/tools/explorer/

# またはこのエンドポイントで確認
curl -X GET "https://graph.threads.net/v19.0/me?fields=username,name&access_token=YOUR_ACCESS_TOKEN"
```

レスポンス例：
```json
{
  "username": "your_threads_handle",
  "name": "Your Name",
  "id": "123456789"  // これが THREADS_USER_ID
}
```

#### 3. アクセストークンの取得

**短期トークン（1時間有効）**

```bash
curl -X GET "https://graph.instagram.com/oauth/authorize?client_id=YOUR_APP_ID&redirect_uri=https://localhost/&scope=threads_basic_access,threads_content_publish&response_type=code"
```

**長期トークン（60日有効）**

取得したコードを使用：
```bash
curl -X POST "https://graph.instagram.com/v19.0/oauth/access_token?client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&grant_type=authorization_code&redirect_uri=https://localhost/&code=CODE"
```

### 必要なアクセストークンスコープ

- `threads_basic_access` - Threadsアカウントへのアクセス
- `threads_content_publish` - 投稿の公開

## 使い方

### 環境確認

```bash
npm run test
# または
node index.js --check
```

楽天API接続と環境変数を確認します。

### ドライラン（投稿せずに確認）

```bash
npm run dry-run
# または
node index.js --dry-run
```

投稿内容を確認した後、Threads投稿をスキップします。

### 今すぐ投稿

```bash
npm run post
# または
node index.js --now
```

即座に投稿を実行します。

### 自動投稿開始（毎日19時）

```bash
npm start
# または
node index.js
```

スケジューラーが起動し、毎日19時に自動投稿します。

## ファイル構成

```
rakuten-travel-threads/
├── index.js                 # メインアプリケーション
├── src/
│   ├── rakuten.js          # 楽天API連携
│   ├── threads.js          # Threads API連携
│   ├── postGenerator.js    # 投稿文生成
│   ├── scheduler.js        # cronスケジューラー
│   ├── storage.js          # 投稿履歴管理
│   └── logger.js           # ロギング
├── logs/                   # 投稿ログ（自動生成）
├── posted-hotels.json      # 投稿済みホテル記録
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## ログファイル

投稿ログは `logs/app.log` に保存されます。

各行がJSON形式で、以下の情報を含みます：

```json
{
  "timestamp": "2026-08-04 19:00:00 +09:00",
  "level": "INFO|ERROR|WARN|SUCCESS",
  "message": "ログメッセージ",
  "hotelName": "宿名（メタデータ）"
}
```

## 環境変数リファレンス

| 変数 | 説明 | 例 |
|------|------|-----|
| `RAKUTEN_APPLICATION_ID` | 楽天API認証ID | `1234567890` |
| `RAKUTEN_AFFILIATE_ID` | 楽天アフィリエイトID | `12345-67890` |
| `THREADS_USER_ID` | ThreadsユーザーID | `123456789` |
| `THREADS_ACCESS_TOKEN` | Threadsアクセストークン | `EAAxx...` |
| `SEARCH_KEYWORDS` | 検索キーワード（カンマ区切り） | `由布院,別府,福岡` |
| `TIMEZONE` | タイムゾーン | `Asia/Tokyo` |
| `POST_HOUR` | 投稿時間（24時間形式） | `19` |

## スコアリングアルゴリズム

各ホテルは以下のスコアで評価されます：

```javascript
score =
  reviewAverage * 20 +          // 口コミ評価: 最大100点
  log10(reviewCount + 1) * 10 + // 口コミ件数: 0-40点
  hasAffiliateUrl * 30 +        // アフィリエイトURL: 0-30点
  hasImageUrl * 10;             // 画像あり: 0-10点
```

最高スコアのホテルが選択されます。

## 投稿文の形式

@hina.mama.otoku風の親しみやすいスタイルで、毎回異なるバリエーションを生成します。

### 投稿例

```
ヤッバイ

由布院にある 由布院温泉旅館 が
4.5⭐(250件)で 12,000円〜25,000円！？！？

このホテルもっとやばいのが…

---

📍 由布岳を眺める温泉宿
✨ 温泉 / 地元食材
💰 12,000円〜25,000円

https://rakuten.co.jp/affiliate/...?pr
```

### テンプレート要素

| 要素 | 説明 | バリエーション |
|------|------|------------|
| 感嘆詞 | 注意引くオープニング | えっぐい / ヤッバイ / 事件です / ちょっとえぐいんだけど / ヤバい😳 |
| フック行 | 地域 + 宿名 + 評価 + 価格 | 驚き表現 `！？！？` |
| クリフハンガー | 続きが気になる文言 | もっとやばいのが… / アレじゃん… / この値段じゃん… / 他の宿選べんぞ… |
| メリット | キャッチコピー + 特徴2項目 | 最大2項目（`/` で区切り） |
| リンク | 楽天アフィリエイトURL | `?pr` 自動付与 |

**文字数**: 150-180文字（Threadsフィード最適化）

## 重複投稿防止

- 過去30日間に投稿したホテルは自動スキップ
- 投稿済みホテル情報は `posted-hotels.json` に記録
- すべてのホテルが投稿済みの場合は別キーワードで再検索

## エラーハンドリング

### 楽天 API エラー

| ステータス | 対応 |
|-----------|------|
| 401/403 | リトライなし（認証エラー） |
| 429 | 2/5/10秒でリトライ（レート制限） |
| 5xx | 2/5/10秒でリトライ（サーバーエラー） |
| ネットワークエラー | 2/5/10秒でリトライ |

### Threads API エラー

| ステータス | 対応 |
|-----------|------|
| 401 | 中止（トークン期限切れ） |
| 403 | 中止（権限不足） |
| 429 | リトライ（レート制限） |
| 5xx | リトライ（サーバーエラー） |

### ログの記録内容

エラー時は以下が記録されます：

- HTTP ステータスコード
- エラーメッセージ
- 処理段階
- リトライ回数

**センシティブ情報は自動マスク**（APIキー・トークン等）

## 環境別運用方法

### Linux/Mac（ローカル開発）

```bash
# 前景実行
npm start

# 背景実行
nohup npm start > app.log 2>&1 &

# 停止
pkill -f "node index.js"
```

### GitHub Actions

`.github/workflows/daily-post.yml` を作成：

```yaml
name: Daily Threads Post

on:
  schedule:
    - cron: '0 10 * * *'  # UTC 10:00 = JST 19:00

jobs:
  post:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm run post
        env:
          RAKUTEN_APPLICATION_ID: ${{ secrets.RAKUTEN_APPLICATION_ID }}
          RAKUTEN_AFFILIATE_ID: ${{ secrets.RAKUTEN_AFFILIATE_ID }}
          THREADS_USER_ID: ${{ secrets.THREADS_USER_ID }}
          THREADS_ACCESS_TOKEN: ${{ secrets.THREADS_ACCESS_TOKEN }}
```

### Render Cron Jobs

1. Render ダッシュボードから「Create」→「Cron Job」
2. リポジトリをコネクト
3. スケジュール設定：`0 10 * * *` (JST 19:00)
4. コマンド：`npm run post`

### Railway

```yaml
# railway.toml
[crons]
post-job = { cmd = "npm run post", cron = "0 10 * * *" }
```

### Cloud Run Jobs (Google Cloud)

```bash
gcloud run jobs create rakuten-threads-daily \
  --image gcr.io/PROJECT_ID/rakuten-threads \
  --schedule "0 10 * * *" \
  --timezone Asia/Tokyo \
  --region asia-northeast1
```

Dockerfile：
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "run", "post"]
```

### AWS EventBridge + Lambda

1. Lambda関数を作成
2. イベントルールを作成：`cron(0 10 * * ? *)`
3. トリガー：EventBridge
4. environment variables を設定

### Vercel Crons

`vercel.json`:
```json
{
  "crons": [{
    "path": "/api/post",
    "schedule": "0 10 * * *"
  }]
}
```

## よくあるエラーと対応

### 「RAKUTEN_APPLICATION_ID not found」

`.env` ファイルを確認：

```bash
# 確認
cat .env | grep RAKUTEN_APPLICATION_ID

# なければ設定
echo "RAKUTEN_APPLICATION_ID=xxx" >> .env
```

### 「401 Unauthorized」（Threads API）

トークンが期限切れの可能性：

```bash
# 新しいトークンを取得
# https://developers.facebook.com/tools/explorer/

# .env を更新
nano .env
```

### 「429 Too Many Requests」

レート制限に達しています。自動リトライが動作します。

カスタム待機時間：

```javascript
// src/rakuten.js, src/threads.js の RETRY_DELAYS を変更
const RETRY_DELAYS = [5000, 10000, 15000]; // ミリ秒
```

### 「No hotels found」

- キーワードが検索に該当しないまたは空きなし
- 楽天API の応答がない
- 自動的に別キーワードで再検索されます

### 「ホテルスコアが低い」

- 口コミ評価が低い
- 口コミ件数が少ない
- 画像がない
- アフィリエイトURL がない

スコアリングロジックを確認：

```bash
node index.js --dry-run
```

## PR表記について

Threadsアフィリエイト投稿には `※PR` を必ず記載します。

- **投稿文に必須**：著作権法・景表法対応
- **自動挿入**：postGenerator.js で自動付与
- **表示内容**：投稿本文に含まれる

## トラブルシューティング

### ローカルテスト

```bash
# 環境確認
node index.js --check

# ドライラン
node index.js --dry-run

# ログ確認
tail -f logs/app.log

# JSON形式でログをパース
cat logs/app.log | jq '.' | head -20
```

### 楽天API デバッグ

```bash
# APIレスポンスを確認
curl "https://app.rakuten.co.jp/services/api/Travel/VacantHotelSearch/20170426?applicationId=YOUR_ID&affiliateId=YOUR_AFFILIATE_ID&keyword=由布院&hits=5"
```

### Threads API デバッグ

```bash
# トークン確認
curl -X GET "https://graph.threads.net/v19.0/me?access_token=YOUR_TOKEN"

# 投稿コンテナ作成テスト
curl -X POST "https://graph.threads.net/YOUR_USER_ID/threads" \
  -d "text=Test" \
  -d "access_token=YOUR_TOKEN"
```

## ライセンス

MIT License

## サポート

問題が発生した場合：

1. ログファイルを確認：`logs/app.log`
2. `node index.js --check` で環境確認
3. APIクレデンシャルが正しいか確認
4. ネットワーク接続を確認

## 注意事項

- アクセストークンは安全に保管してください
- `.env` ファイルを絶対にGitにコミットしないこと
- 楽天・Meta のAPI利用規約を遵守してください
- 大量投稿でレート制限に達しないよう注意

## 今後のアップデート予定

- [ ] 画像URLの取得と投稿
- [ ] 複数キーワードの同時検索・並列処理
- [ ] 投稿スケジュール管理UI
- [ ] Threads Analytics 連携
- [ ] Slack/Discord 通知機能
- [ ] データベース対応（SQLite/PostgreSQL）
