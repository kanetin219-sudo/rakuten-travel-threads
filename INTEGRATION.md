# Threads Graph API 統合ガイド

## 概要

このドキュメントは、Threads Graph APIを使用してエンゲージメントメトリクス（いいね数・コメント数・シェア数・インプレッション）を取得し、Supabaseに保存する機能の統合ガイドです。

---

## ファイル構成

### 新規作成ファイル

- **`src/threadsMetrics.js`** - Threads APIメトリクス取得のメインモジュール
  - `getSinglePostMetrics(postId, accessToken)` - 単一投稿のメトリクス取得
  - `batchGetPostMetrics(postIds, accessToken)` - 複数投稿のバッチ取得
  - `getUserPostsMetrics(userId, accessToken)` - ユーザーの全投稿取得
  - `getRateLimitInfo()` - API レート制限情報の確認

### 修正ファイル

- **`index.js`** - メイン処理ファイル
  - Supabase クライアント初期化処理追加
  - `initSupabase()` - Supabase初期化
  - `saveMetricsToSupabase()` - メトリクス保存
  - `fetchAndSaveAllPostMetrics()` - 全投稿メトリクス取得・保存
  - 投稿後のメトリクス自動取得処理追加
  - `--metrics` コマンド追加

- **`package.json`** - 依存関係更新
  - `@supabase/supabase-js` ^2.43.0 追加

- **`.env.example`** - 環境変数テンプレート更新
  - `SUPABASE_URL` 追加
  - `SUPABASE_KEY` 追加

---

## セットアップ手順

### 1. 環境変数の設定

`.env` ファイルに以下の項目を追加：

```env
# Supabase設定
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anonymous-key
```

> **取得方法**
> 1. Supabase Dashboard (https://app.supabase.com) にログイン
> 2. プロジェクト選択 → Settings → API
> 3. `Project URL` と `anon public` キーをコピー

### 2. Supabase テーブルの作成

Supabase SQL エディタで以下を実行：

```sql
-- engagement テーブルの作成
CREATE TABLE engagement (
  id BIGSERIAL PRIMARY KEY,
  post_id TEXT UNIQUE NOT NULL,
  like_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  impressions_count INTEGER DEFAULT 0,
  fetched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックスの作成
CREATE INDEX engagement_post_id_idx ON engagement(post_id);
CREATE INDEX engagement_fetched_at_idx ON engagement(fetched_at DESC);
```

### 3. npm install

```bash
npm install
```

---

## 使用方法

### パターン1: 投稿時に自動的にメトリクスを取得

```bash
npm start
# または
node index.js --now
```

投稿成功時に、自動的に新しい投稿のメトリクスを取得してSupabaseに保存します。

### パターン2: 全投稿のメトリクスを一括取得

```bash
node index.js --metrics
```

ユーザーの全投稿についてメトリクスを取得し、Supabaseに保存します。

**出力例：**
```
============================================================
📊 Fetching Threads Metrics
============================================================

============================================================
✅ Metrics fetched successfully
   Total posts: 25
   Saved: 25
============================================================
```

### パターン3: 単一投稿のメトリクス取得（スクリプト例）

```javascript
const threadsMetrics = require('./src/threadsMetrics');

const postId = 'YOUR_POST_ID';
const accessToken = process.env.THREADS_ACCESS_TOKEN;

const metrics = await threadsMetrics.getSinglePostMetrics(postId, accessToken);

console.log(metrics);
// 出力:
// {
//   post_id: '27441...',
//   text: 'Post content...',
//   like_count: 42,
//   comments_count: 8,
//   shares_count: 2,
//   impressions_count: 1250,
//   fetched_at: '2026-08-12T10:30:00.000Z'
// }
```

### パターン4: 複数投稿のバッチ取得

```javascript
const threadsMetrics = require('./src/threadsMetrics');

const postIds = ['POST_ID_1', 'POST_ID_2', 'POST_ID_3'];
const accessToken = process.env.THREADS_ACCESS_TOKEN;

const result = await threadsMetrics.batchGetPostMetrics(postIds, accessToken);

console.log(result);
// 出力:
// {
//   success: [
//     { post_id: '...',  like_count: 42, ... },
//     { post_id: '...', like_count: 31, ... }
//   ],
//   failed: [
//     { post_id: 'INVALID', error: 'Post not found' }
//   ],
//   total: 3,
//   successCount: 2,
//   failureCount: 1
// }
```

---

## API 仕様

### Threads Graph API エンドポイント

#### 1. 単一投稿のメトリクス取得

```
GET https://graph.threads.net/{post_id}?fields=id,text,like_count,comments_count,shares_count,impressions_count&access_token={token}
```

**レスポンス例：**
```json
{
  "id": "27441234567890123",
  "text": "おすすめのホテル...",
  "like_count": 42,
  "comments_count": 8,
  "shares_count": 2,
  "impressions_count": 1250
}
```

#### 2. ユーザー全投稿のメトリクス取得

```
GET https://graph.threads.net/{user_id}/threads?fields=id,text,like_count,comments_count,shares_count,impressions_count&access_token={token}
```

**レスポンス例：**
```json
{
  "data": [
    {
      "id": "27441234567890123",
      "text": "Post 1 content...",
      "like_count": 42,
      "comments_count": 8,
      "shares_count": 2,
      "impressions_count": 1250
    },
    {
      "id": "27441234567890124",
      "text": "Post 2 content...",
      "like_count": 31,
      "comments_count": 5,
      "shares_count": 1,
      "impressions_count": 945
    }
  ],
  "paging": {
    "cursors": {
      "before": "...",
      "after": "..."
    }
  }
}
```

---

## API レート制限（Rate Limiting）

### 制限仕様

Threads Graph APIの制限：
- **ウィンドウ:** 15分間
- **制限:** 200リクエスト/15分
- **リセット時間:** HTTPレスポンスの `X-App-Rate-Limit-Reset` ヘッダーで取得

### 内部実装

`threadsMetrics.js` は以下の対策を講じています：

1. **レート制限の自動トラッキング**
   ```javascript
   const rateLimitState = {
     remaining: 200,      // 残りリクエスト数
     resetTime: null,     // リセット時刻（Unix timestamp ms）
     requestCount: 0,     // 現在のウィンドウでのリクエスト数
   };
   ```

2. **自動待機とリトライ**
   - 429エラー（Rate Limited）を自動検出
   - リセット時間まで待機
   - 最大3回まで自動リトライ

3. **バッチリクエストの遅延挿入**
   ```javascript
   // 200msの遅延を各リクエスト間に挿入
   for (let i = 0; i < postIds.length; i++) {
     await getSinglePostMetrics(postId, accessToken);
     if (i < postIds.length - 1) {
       await sleep(200);
     }
   }
   ```

### レート制限情報の確認

```javascript
const threadsMetrics = require('./src/threadsMetrics');

const info = threadsMetrics.getRateLimitInfo();
console.log(info);
// 出力:
// {
//   remaining: 195,  // 残りリクエスト数
//   resetTime: "2026-08-12T10:45:00.000Z",  // リセット時刻
//   requestCount: 5  // 現在のウィンドウでのリクエスト数
// }
```

### レート制限エラーの処理

レート制限に達した場合、以下のログが出力されます：

```
[WARN] Rate limit reached. Waiting 24000ms before retry...
[INFO] Waiting 24000ms before retry...
```

自動的に待機して再試行するため、通常はユーザー側での対応は不要です。

---

## エラーハンドリング

### エラー分類と対応

| エラー | ステータス | 再試行 | 説明 |
|--------|-----------|--------|------|
| 認証失敗 | 401 | ❌ | トークン無効・期限切れ |
| 権限なし | 403 | ❌ | アクセス権限不足 |
| レート制限 | 429 | ✅ | API呼び出し超過（自動待機） |
| サーバーエラー | 500+ | ✅ | サーバー側障害（最大3回リトライ） |
| ネットワークエラー | ECONNREFUSED等 | ✅ | ネットワーク問題（最大3回リトライ） |
| 投稿未検出 | (通常) | ❌ | 投稿ID不正・削除済み |

### ログレベル

```
[INFO]   - 標準情報（メトリクス取得成功など）
[WARN]   - 警告（レート制限・一部失敗など）
[ERROR]  - エラー（認証失敗・投稿不検出など）
```

---

## テスト方法

### テスト1: 環境チェック

```bash
npm run test
# または
node index.js --check
```

**出力確認項目：**
- ✅ THREADS_USER_ID configured
- ✅ THREADS_ACCESS_TOKEN configured
- ✅ SUPABASE_URL configured
- ✅ SUPABASE_KEY configured

### テスト2: 単一投稿のメトリクス取得

```bash
node -e "
const threadsMetrics = require('./src/threadsMetrics');
const dotenv = require('dotenv');
dotenv.config();

(async () => {
  const postId = process.env.THREADS_USER_ID; // ユーザーIDをテストで使用
  const token = process.env.THREADS_ACCESS_TOKEN;
  
  try {
    console.log('Fetching metrics for post: ' + postId);
    const metrics = await threadsMetrics.getSinglePostMetrics(postId, token);
    console.log('✅ Success:', metrics);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
})();
"
```

### テスト3: 全投稿メトリクス取得

```bash
node index.js --metrics
```

**確認項目：**
- 投稿数が正しく表示されているか
- 全投稿のメトリクスが取得できているか
- Supabaseに正しく保存されているか

### テスト4: 手動投稿時のメトリクス自動取得

```bash
node index.js --now
```

**ログで確認：**
```
[INFO] Fetching metrics for newly posted content...
[INFO] Metrics fetched successfully for post 274412...
[INFO] Metrics saved successfully for post 274412...
```

---

## トラブルシューティング

### エラー: "SUPABASE_URL or SUPABASE_KEY not set"

**原因:** Supabase認証情報が未設定

**解決方法:**
```bash
# .env ファイルを確認
cat .env | grep SUPABASE

# 設定されていない場合は追加
echo "SUPABASE_URL=https://your-project.supabase.co" >> .env
echo "SUPABASE_KEY=your-key" >> .env
```

### エラー: "Rate limited by Threads API"

**原因:** 15分間に200リクエスト超過

**対応:**
- 自動的に待機してリトライされます
- 大量の投稿を処理する場合は、時間を分散してください

```javascript
// 例：5投稿を2時間かけて処理
for (let i = 0; i < 5; i++) {
  await fetchAndSaveAllPostMetrics();
  await sleep(24 * 60 * 1000); // 24分待機
}
```

### エラー: "Invalid response from Threads API"

**原因:** 投稿IDが不正・削除済み

**確認方法:**
```bash
# 投稿IDの形式を確認（19〜21桁の数字）
echo "27441553552152891" | wc -c
```

### Supabaseに保存されない

**確認事項:**

1. Supabase接続確認
   ```javascript
   const env = require('dotenv').config().parsed;
   console.log('SUPABASE_URL:', env.SUPABASE_URL);
   console.log('SUPABASE_KEY:', env.SUPABASE_KEY ? '✅ Set' : '❌ Not set');
   ```

2. engagement テーブル確認
   ```sql
   SELECT * FROM engagement LIMIT 1;
   ```

3. RLS設定確認
   ```
   Supabase Dashboard → Authentication → Policies
   ```

---

## パフォーマンス考慮事項

### 推奨運用方法

1. **日次更新**
   ```bash
   # crontab設定例（毎日21時に実行）
   0 21 * * * cd /path/to/rakuten-travel-threads && node index.js --metrics
   ```

2. **大量投稿の処理**
   ```bash
   # 50投稿以上の場合、複数日に分散
   node index.js --metrics  # 初回：25投稿処理
   # 次の日
   node index.js --metrics  # 2回目：残り25投稿処理
   ```

3. **レート制限の余裕を確保**
   - 1時間に最大8回の `--metrics` 実行が安全
   - 各実行で最大25投稿まで推奨

---

## ログ出力例

### 成功時
```
[INFO] Fetching metrics for 5 posts
[INFO] Fetching metrics for post 27441234567890123 (Retry: 0/3)
[INFO] Metrics fetched successfully for post 27441234567890123
[INFO] Saving metrics to Supabase for post 27441234567890123
[INFO] Metrics saved successfully for post 27441234567890123
```

### レート制限発生時
```
[WARN] Rate limited by Threads API. Reset at: 1691234567
[INFO] Waiting 24000ms before retry...
[INFO] Fetching metrics for post 27441234567890123 (Retry: 1/3)
[INFO] Metrics fetched successfully for post 27441234567890123
```

### エラー発生時
```
[ERROR] Threads API auth error (401)
[ERROR] Failed to fetch metrics for post 27441234567890123
[ERROR] Error: Invalid access token
```

---

## 今後の拡張予定

- [ ] スケジュール機能（毎日自動メトリクス更新）
- [ ] メトリクスダッシュボード機能
- [ ] エンゲージメント分析レポート生成
- [ ] Slack通知機能（異常値検知時）
- [ ] ヒートマップ分析（最適投稿時間の検出）

---

## FAQ

**Q: メトリクスはいつ取得できる？**  
A: 投稿直後から取得可能です。投稿1〜2分後にメトリクスが反映されます。

**Q: 過去投稿のメトリクスも取得できる？**  
A: はい。投稿IDがあれば、いつの投稿でも取得可能です。

**Q: インプレッション数が0の場合がある？**  
A: 投稿直後や新規投稿の場合、インプレッション数が算出されるまでの時間差があります。

**Q: レート制限に達したら？**  
A: 自動的に待機して再試行します。ユーザー側での対応は不要です。

**Q: Supabase無しで動作できる？**  
A: はい。Supabase設定なしでもメトリクス取得は可能です（ログ出力のみ）。

---

## サポート・問題報告

実装に関する質問・問題がある場合は、以下をご確認ください：

1. `.env` に全ての必須項目が設定されているか
2. `npm run test` で環境チェックが通るか
3. Supabase ダッシュボードで API キーが正しいか
4. ログで詳細なエラーメッセージを確認
