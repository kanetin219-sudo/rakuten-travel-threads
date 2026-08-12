# Threads 投稿自動保存機能 実装完了

## 修正ファイル

| ファイルパス | 修正内容 |
|-----------|---------|
| `src/threads.js` | Supabase クライアント機能追加・新関数 2 つ追加 |
| `index.js` | 投稿処理を postToThreadsWithSupabase に変更 |

---

## src/threads.js の変更

### 追加コード

```javascript
// dayjs タイムゾーン拡張を追加
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

// 新規関数 1: savePostToSupabase
const savePostToSupabase = async (supabaseClient, postData) => { ... }

// 新規関数 2: postToThreadsWithSupabase
const postToThreadsWithSupabase = async (
  textOrArray,
  threadsUserId,
  accessToken,
  supabaseClient,
  hotelInfo = null,
  qualityScore = null
) => { ... }
```

### 保存するデータ

```
posts テーブルに以下を UPSERT:
- post_id: Threads API 返却 ID
- content: 投稿テキスト
- hotel_info: ホテル情報 JSON
- created_at: 作成日時 (JST)
- posted_at: 投稿日時 (JST)
- quality_score: 品質スコア (0-100)
```

---

## index.js の変更

### 修正前
```javascript
const postId = await threads.postToThreads(
  [postText1, postText2],
  env.THREADS_USER_ID,
  env.THREADS_ACCESS_TOKEN
);
```

### 修正後
```javascript
const postResult = await threads.postToThreadsWithSupabase(
  [postText1, postText2],
  env.THREADS_USER_ID,
  env.THREADS_ACCESS_TOKEN,
  supabaseClient,
  {
    hotelNo: selectedHotel.hotelNo,
    hotelName: selectedHotel.hotelName,
    area: selectedHotel.area,
    minPrice: selectedHotel.minPrice,
    maxPrice: selectedHotel.maxPrice,
    catchCopy: selectedHotel.catchCopy,
    reviewAverage: selectedHotel.reviewAverage,
    reviewCount: selectedHotel.reviewCount,
    affiliateUrl: selectedHotel.affiliateUrl,
  },
  gatekeeperResult.averageScore
);

// エラー処理を追加
if (!postResult.success) {
  logger.error('Failed to post to Threads with Supabase save', {...});
  return { success: false, error: postResult.error };
}

const postId = postResult.postId;
```

---

## Supabase テーブル定義

```sql
CREATE TABLE posts (
  post_id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  hotel_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  posted_at TIMESTAMP WITH TIME ZONE,
  quality_score INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX posts_created_at_idx ON posts(created_at DESC);
CREATE INDEX posts_quality_score_idx ON posts(quality_score DESC);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON posts
  FOR ALL USING (true) WITH CHECK (true);
```

---

## 動作確認方法

### 1. 構文チェック
```bash
node -c src/threads.js
node -c index.js
```

### 2. テスト投稿
```bash
npm run post  # 実際に 1 回投稿してテスト
```

### 3. Supabase で確認
```sql
SELECT * FROM posts ORDER BY created_at DESC LIMIT 1;
```

**確認項目:**
- ✅ post_id が Threads API ID と一致
- ✅ content に投稿テキスト（両パート）が保存
- ✅ hotel_info にホテル情報が JSON で保存
- ✅ quality_score に品質スコア（例：92）が保存
- ✅ created_at / posted_at がJST時刻

---

## エラーハンドリング

| 状況 | 動作 |
|------|------|
| Supabase 保存失敗 | 投稿は成功・ログ警告 |
| ネットワーク障害 | 3 回自動リトライ |
| Supabase 未設定 | 投稿のみ実行・警告ログ |

---

## 環境変数確認

`.env` に以下が設定されていることを確認：

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJxxxx...
```

---

## 完成度

- ✅ 投稿時自動保存
- ✅ ホテル情報 JSON 保存
- ✅ 品質スコア記録
- ✅ タイムゾーン対応（JST）
- ✅ エラーハンドリング
- ✅ ログ出力
- ✅ 構文チェック完了

すべて完成したやが。
