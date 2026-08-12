# Rakuten Travel Threads - Supabase セットアップガイド

**作成日:** 2026-08-09  
**プロジェクト:** rakuten-travel-threads  
**Supabase プロジェクト:** travel_miyazaki (ygqmevyetdwyebvgqcbo)  
**リージョン:** ap-southeast-1

---

## 1. プロジェクト情報

| 項目 | 内容 |
|------|------|
| **Supabase URL** | https://ygqmevyetdwyebvgqcbo.supabase.co |
| **プロジェクトID** | ygqmevyetdwyebvgqcbo |
| **リージョン** | ap-southeast-1 |
| **ステータス** | ACTIVE_HEALTHY |
| **Postgresバージョン** | 17 |

---

## 2. 環境変数設定

`.env` ファイルに以下の環境変数を追加済み：

```bash
# Supabase Configuration
SUPABASE_URL=https://ygqmevyetdwyebvgqcbo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncW1ldnlldGR3eWVidmdxY2JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NTEyMzIsImV4cCI6MjA5ODUyNzIzMn0.v9HYqhjRuwU2i2JMEJyAUnbiQxRHvgM61JM6A-XEBgg
SUPABASE_PUBLISHABLE_KEY=sb_publishable_EY_PVuE4slpZqIu3Y748mQ_y3ztXolM
```

---

## 3. 既存テーブル構造

### 3.1 travel_hotels（既存）
**行数:** 100  
**RLS:** DISABLED（有効化予定）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | プライマリキー |
| hotel_id | text | ホテルID |
| hotel_name | text | ホテル名 |
| region | text | 地域 |
| hotel_type | text (nullable) | ホテルタイプ |
| rakuten_url | text (nullable) | 楽天リンク |
| discount_rate | integer (nullable) | 割引率 |
| original_price | integer | 定価 |
| discount_price | integer | 割引後価格 |
| status | text | ステータス（デフォルト: 'active'） |
| created_at | timestamptz (nullable) | 作成日時 |
| updated_at | timestamptz (nullable) | 更新日時 |

**今回追加するカラム:**
- `rakuten_hotel_no` (TEXT UNIQUE) - 楽天API の hotelNo
- `min_price` (INTEGER) - 最安値（1人あたり）
- `max_price` (INTEGER) - 最高値（1人あたり）
- `review_average` (DECIMAL(3,2)) - 口コミ平均点
- `review_count` (INTEGER) - 口コミ数
- `catch_copy` (TEXT) - キャッチコピー
- `feature_keywords` (TEXT) - 特徴キーワード
- `image_url` (TEXT) - 画像URL（主画像）

### 3.2 travel_queue（既存）
**行数:** 0  
**RLS:** DISABLED（有効化予定）  
**用途:** 投稿予約キュー

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | プライマリキー |
| hotel_id | uuid | travel_hotels への参照 |
| thread_text_1 | text (nullable) | スレッド本文パート1 |
| thread_text_2 | text (nullable) | スレッド本文パート2 |
| scheduled_time | timestamptz (nullable) | 投稿予定日時 |
| status | text | ステータス（pending/posted/failed） |
| posted_at | timestamptz (nullable) | 投稿完了日時 |
| thread_url | text (nullable) | Threads投稿URL |
| created_at | timestamptz (nullable) | 作成日時 |
| updated_at | timestamptz (nullable) | 更新日時 |

### 3.3 travel_analytics（既存）
**行数:** 0  
**RLS:** ENABLED  
**用途:** Threads投稿のエンゲージメント分析

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | プライマリキー |
| thread_url | text | Threads投稿URL（UNIQUE） |
| hotel_id | uuid | hotel への参照 |
| likes_count | integer | いいね数（デフォルト: 0） |
| replies_count | integer | 返信数（デフォルト: 0） |
| reposts_count | integer | リポスト数（デフォルト: 0） |
| total_engagement | integer | 合計エンゲージメント（デフォルト: 0） |
| engagement_rate | double precision | エンゲージメント率（デフォルト: 0） |
| fetched_at | timestamptz (nullable) | 最終フェッチ日時 |
| created_at | timestamptz (nullable) | 作成日時 |

---

## 4. 新規作成テーブル

### 4.1 rakuten_travel_posts
**用途:** Threads投稿履歴  
**RLS:** ENABLED

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | プライマリキー |
| post_id | text | Threads API から返される投稿ID（UNIQUE） |
| content | text | 投稿テキスト（500文字以下） |
| hotel_info | jsonb | ホテル情報（hotelNo, hotelName, area, price等） |
| hotel_id | bigint | travel_hotels への参照（nullable） |
| hotel_name | text | ホテル名（検索用） |
| region | text | 地域（検索用） |
| threads_url | text | Threads投稿URL |
| posted_at | timestamptz | 投稿日時（Threads APIレスポンス時刻） |
| created_at | timestamptz | 作成日時 |
| updated_at | timestamptz | 更新日時 |

**インデックス:**
- `idx_rakuten_travel_posts_post_id` - post_id
- `idx_rakuten_travel_posts_hotel_id` - hotel_id
- `idx_rakuten_travel_posts_posted_at` - posted_at DESC
- `idx_rakuten_travel_posts_created_at` - created_at DESC

**RLS ポリシー:**
- SELECT: 全員可能
- INSERT: 全員可能（GAS内部用）
- UPDATE: 全員可能

### 4.2 rakuten_travel_engagement
**用途:** Threads投稿のエンゲージメント指標  
**RLS:** ENABLED

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | プライマリキー |
| post_id | text | Threads投稿ID（UNIQUE） |
| threads_post_id | uuid | rakuten_travel_posts への参照（nullable） |
| likes_count | integer | いいね数 |
| comments_count | integer | コメント数 |
| shares_count | integer | シェア数 |
| reposts_count | integer | リポスト数 |
| impressions_count | integer | インプレッション数 |
| total_engagement | integer | 合計 = likes + comments + shares + reposts |
| engagement_rate | double precision | エンゲージメント率 = total / impressions |
| fetched_at | timestamptz | 最後にフェッチした日時 |
| created_at | timestamptz | 作成日時 |
| updated_at | timestamptz | 更新日時 |

**インデックス:**
- `idx_rakuten_travel_engagement_post_id` - post_id
- `idx_rakuten_travel_engagement_threads_post_id` - threads_post_id
- `idx_rakuten_travel_engagement_fetched_at` - fetched_at DESC
- `idx_rakuten_travel_engagement_created_at` - created_at DESC

**RLS ポリシー:**
- SELECT: 全員可能
- INSERT: 全員可能（Analytics収集用）
- UPDATE: 全員可能

### 4.3 rakuten_travel_posted_hotels
**用途:** 投稿済みホテル履歴（JSON ファイルの代わり）  
**RLS:** ENABLED

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | プライマリキー |
| hotel_no | text | 楽天API hotelNo |
| hotel_name | text | ホテル名 |
| region | text | 地域 |
| posted_at | timestamptz | 投稿日時 |
| post_id | text | rakuten_travel_posts への参照（nullable） |
| created_at | timestamptz | 作成日時 |

**インデックス:**
- `idx_rakuten_posted_hotels_hotel_no` - hotel_no
- `idx_rakuten_posted_hotels_posted_at` - posted_at DESC
- `idx_rakuten_posted_hotels_post_id` - post_id

**RLS ポリシー:**
- 全操作可能

### 4.4 rakuten_travel_settings
**用途:** プロジェクト設定  
**RLS:** ENABLED

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | プライマリキー |
| setting_key | text | 設定キー（UNIQUE） |
| setting_value | text | 設定値 |
| description | text | 説明 |
| created_at | timestamptz | 作成日時 |
| updated_at | timestamptz | 更新日時 |

**インデックス:**
- `idx_rakuten_settings_key` - setting_key

**RLS ポリシー:**
- 全操作可能

---

## 5. セットアップ手順

### 5.1 SQL マイグレーション実行

1. **Supabase コンソールで実行:**
   - https://supabase.com/dashboard/project/ygqmevyetdwyebvgqcbo/sql/templates にアクセス
   - 「New Query」をクリック
   - `supabase-migrations.sql` の内容をコピー＆ペースト
   - 「Run」ボタンをクリック

2. または **Supabase CLI を使用:**
   ```bash
   supabase db push
   ```

### 5.2 .env ファイル確認

```bash
# Supabase Configuration がすでに追加済み
SUPABASE_URL=https://ygqmevyetdwyebvgqcbo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_PUBLISHABLE_KEY=sb_publishable_EY_PVuE4slpZqIu3Y748mQ_y3ztXolM
```

### 5.3 Node.js パッケージインストール

```bash
npm install @supabase/supabase-js
```

### 5.4 storage.js を Supabase 連携版に更新

既存の JSON ファイルベースから Supabase に移行してください。

---

## 6. セキュリティに関する注意

### 6.1 RLS ポリシー

**注意:** 現在のポリシーはすべて「全員可能」に設定されています。本番環境では以下の対応が必要です：

- **READ:** ユーザー認証なし（ダッシュボード閲覧用）
- **INSERT/UPDATE:** 認証ユーザーのみ、または特定のサービスロールのみ
- **DELETE:** 厳密に制限（管理者のみ）

### 6.2 セクレット管理

- `THREADS_ACCESS_TOKEN` は絶対に GitHub に公開しないこと
- `.env` ファイルは `.gitignore` に含めること
- 本番環境では環境変数として設定すること

---

## 7. 既存データ状況

| テーブル | 行数 | ステータス |
|---------|------|----------|
| travel_hotels | 100 | 既存データあり |
| travel_queue | 0 | 空 |
| travel_analytics | 0 | 空 |
| rakuten_travel_posts | 0 | 新規 |
| rakuten_travel_engagement | 0 | 新規 |
| rakuten_travel_posted_hotels | 0 | 新規 |
| rakuten_travel_settings | 0 | 新規 |

---

## 8. 今後の対応

### 8.1 index.js 統合

`src/storage.js` を Supabase 連携版に更新：

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const savePostedHotel = async (hotelNo, hotelName, region) => {
  const { data, error } = await supabase
    .from('rakuten_travel_posted_hotels')
    .insert({
      hotel_no: hotelNo,
      hotel_name: hotelName,
      region: region,
      posted_at: new Date().toISOString()
    });
  
  if (error) {
    logger.error('Failed to save posted hotel', { error });
    throw error;
  }
};
```

### 8.2 RLS ポリシー調整

本番環境での厳密なポリシー設定が必要です。

### 8.3 バックアップ設定

- 本番環境での自動バックアップ有効化
- 重要テーブルへの DELETE ポリシー制限

---

## 9. トラブルシューティング

### Q. RLS が有効になっているとエラーが出る場合

**A:** 以下のポリシーが正しく設定されているか確認してください：
```sql
CREATE POLICY "table_allow_all" ON public.table_name
  USING (true) WITH CHECK (true);
```

### Q. 既存データが見えない場合

**A:** RLS ポリシーが記述制限になっている可能性があります：
```sql
ALTER TABLE public.table_name DISABLE ROW LEVEL SECURITY;
-- または適切なポリシーを作成
```

### Q. API キーが無効な場合

**A:** 以下を確認してください：
- `.env` ファイルの設定
- Supabase プロジェクトのキーの有効期限
- キーの読み取り/書き込み権限

---

## 10. リファレンス

- **Supabase ドキュメント:** https://supabase.com/docs
- **RLS ガイド:** https://supabase.com/docs/guides/database/postgres/row-level-security
- **JavaScript クライアント:** https://supabase.com/docs/reference/javascript

---

**作成者:** Claude Code  
**最終更新:** 2026-08-09
