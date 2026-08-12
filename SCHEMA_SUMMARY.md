# Rakuten Travel Threads - スキーマサマリー

**作成日:** 2026-08-09  
**Supabase プロジェクト:** travel_miyazaki (ID: ygqmevyetdwyebvgqcbo)

---

## テーブル一覧

### 既存テーブル（travel_miyazaki 共有）

| テーブル | 行数 | RLS | 用途 |
|---------|------|-----|------|
| `travel_hotels` | 100 | 有効化予定 | ホテル情報キャッシュ（複数プロジェクト共有） |
| `travel_queue` | 0 | 有効化予定 | 投稿予約キュー（複数プロジェクト共有） |
| `travel_analytics` | 0 | ✓ | エンゲージメント分析（複数プロジェクト共有） |
| `hotels` | 0 | ✓ | ホテル情報（affiliate_links用） |
| `affiliate_links` | 0 | ✓ | アフィリエイトリンク管理 |

### Rakuten Travel Threads 専用テーブル（新規）

| テーブル | 用途 | 行数 | RLS | カラム数 |
|---------|------|------|-----|---------|
| `rakuten_travel_posts` | Threads投稿履歴 | 0 | ✓ | 11 |
| `rakuten_travel_engagement` | エンゲージメント指標 | 0 | ✓ | 12 |
| `rakuten_travel_posted_hotels` | 投稿済みホテル履歴 | 0 | ✓ | 7 |
| `rakuten_travel_settings` | プロジェクト設定 | 0 | ✓ | 5 |

---

## 詳細スキーマ

### 1. rakuten_travel_posts
**Threads投稿履歴テーブル**

```
id (UUID) - PK
├─ post_id (TEXT UNIQUE) - Threads API ID
├─ content (TEXT) - 投稿テキスト
├─ hotel_info (JSONB) - ホテルメタデータ
├─ hotel_id (BIGINT FK) - travel_hotels 参照
├─ hotel_name (TEXT) - ホテル名
├─ region (TEXT) - 地域
├─ threads_url (TEXT) - Threads投稿URL
├─ posted_at (TIMESTAMPTZ) - 投稿日時
├─ created_at (TIMESTAMPTZ) - 作成日時
└─ updated_at (TIMESTAMPTZ) - 更新日時

インデックス:
  - post_id
  - hotel_id
  - posted_at DESC
  - created_at DESC
```

**用途:**
- 投稿履歴の記録
- 投稿済みホテルの判定（30日以内）
- 投稿テキスト・ホテル情報の復元

---

### 2. rakuten_travel_engagement
**Threads投稿エンゲージメント指標**

```
id (UUID) - PK
├─ post_id (TEXT UNIQUE) - Threads投稿ID
├─ threads_post_id (UUID FK) - rakuten_travel_posts 参照
├─ likes_count (INTEGER) - いいね数
├─ comments_count (INTEGER) - コメント数
├─ shares_count (INTEGER) - シェア数
├─ reposts_count (INTEGER) - リポスト数
├─ impressions_count (INTEGER) - インプレッション数
├─ total_engagement (INTEGER) - 合計エンゲージメント
├─ engagement_rate (FLOAT) - エンゲージメント率
├─ fetched_at (TIMESTAMPTZ) - 最終フェッチ日時
├─ created_at (TIMESTAMPTZ) - 作成日時
└─ updated_at (TIMESTAMPTZ) - 更新日時

インデックス:
  - post_id
  - threads_post_id
  - fetched_at DESC
  - created_at DESC
```

**用途:**
- 投稿パフォーマンス分析
- エンゲージメント推移追跡
- ホテル別パフォーマンス比較

---

### 3. rakuten_travel_posted_hotels
**投稿済みホテル履歴（posted-hotels.json の代替）**

```
id (UUID) - PK
├─ hotel_no (TEXT) - 楽天 hotelNo
├─ hotel_name (TEXT) - ホテル名
├─ region (TEXT) - 地域
├─ posted_at (TIMESTAMPTZ) - 投稿日時
├─ post_id (TEXT FK) - rakuten_travel_posts 参照
└─ created_at (TIMESTAMPTZ) - 作成日時

インデックス:
  - hotel_no
  - posted_at DESC
  - post_id
```

**用途:**
- 投稿済みホテルの30日内判定
- 重複投稿防止
- 投稿履歴管理

**参考クエリ:**
```sql
-- 過去30日以内に投稿済みのホテルを検出
SELECT hotel_no 
FROM rakuten_travel_posted_hotels
WHERE posted_at > NOW() - INTERVAL '30 days'
GROUP BY hotel_no;
```

---

### 4. rakuten_travel_settings
**プロジェクト設定テーブル**

```
id (UUID) - PK
├─ setting_key (TEXT UNIQUE) - 設定キー
├─ setting_value (TEXT) - 設定値
├─ description (TEXT) - 説明
├─ created_at (TIMESTAMPTZ) - 作成日時
└─ updated_at (TIMESTAMPTZ) - 更新日時

インデックス:
  - setting_key
```

**用途:**
- プロジェクト設定の一元管理
- 環境別設定の切り替え

**推奨設定キー:**
```
max_hotel_price       = 25000
post_hour             = 19
post_frequency        = daily
search_radius         = 2.5
min_hotel_price       = 5000
discount_threshold    = 30
family_keyword_weight = 1.5
```

---

### 5. travel_hotels（既存・拡張）
**ホテル情報キャッシュ**

```
id (UUID) - PK
├─ hotel_id (TEXT) - 楽天 hotelId
├─ hotel_name (TEXT) - ホテル名
├─ region (TEXT) - 地域
├─ hotel_type (TEXT nullable) - タイプ（温泉/グランピング等）
├─ original_price (INTEGER) - 定価
├─ discount_price (INTEGER) - 割引後価格
├─ discount_rate (INTEGER nullable) - 割引率
├─ rakuten_url (TEXT nullable UNIQUE) - 楽天URL
├─ affiliate_link (TEXT nullable) - アフィリエイトリンク
├─ status (TEXT) - ステータス（デフォルト: 'active'）
├─ created_at (TIMESTAMPTZ nullable) - 作成日時
├─ updated_at (TIMESTAMPTZ nullable) - 更新日時
├─ rakuten_hotel_no (TEXT UNIQUE) [新規] - 楽天 hotelNo
├─ min_price (INTEGER) [新規] - 最安値（1人あたり）
├─ max_price (INTEGER) [新規] - 最高値（1人あたり）
├─ review_average (DECIMAL) [新規] - 口コミ平均点
├─ review_count (INTEGER) [新規] - 口コミ数
├─ catch_copy (TEXT) [新規] - キャッチコピー
├─ feature_keywords (TEXT) [新規] - 特徴キーワード
└─ image_url (TEXT) [新規] - 画像URL

既存行数: 100
```

**新規カラムの意味:**
- `rakuten_hotel_no`: 楽天API の `hotelNo` を格納（`hotel_id` との区別）
- `min_price`, `max_price`: 1人あたりの最安・最高価格
- `review_average`, `review_count`: 口コミ評価データ
- `catch_copy`, `feature_keywords`: ホテル説明文
- `image_url`: 主要な画像URL

---

### 6. travel_queue（既存・活用予定）
**投稿予約キュー**

```
id (UUID) - PK
├─ hotel_id (UUID FK) - travel_hotels 参照
├─ thread_text_1 (TEXT nullable) - 本文パート1
├─ thread_text_2 (TEXT nullable) - 本文パート2
├─ scheduled_time (TIMESTAMPTZ nullable) - 投稿予定時刻
├─ status (TEXT) - ステータス（pending/posted/failed）
├─ posted_at (TIMESTAMPTZ nullable) - 投稿完了時刻
├─ thread_url (TEXT nullable) - 投稿URL
├─ created_at (TIMESTAMPTZ nullable) - 作成日時
└─ updated_at (TIMESTAMPTZ nullable) - 更新日時

既存行数: 0
```

**用途:**
- 投稿のスケジューリング
- 複数プロジェクト間での投稿共有

---

## リレーション図

```
rakuten_travel_posts
├─ FK → travel_hotels (hotel_id)
└─ 1-to-1 → rakuten_travel_engagement (post_id)

rakuten_travel_engagement
├─ FK → rakuten_travel_posts (threads_post_id)
└─ FK → travel_hotels (hotel_id)

rakuten_travel_posted_hotels
├─ FK → rakuten_travel_posts (post_id)
└─ References → travel_hotels (hotel_no)

travel_queue
└─ FK → travel_hotels (hotel_id)

travel_analytics
└─ FK → travel_hotels (hotel_id)
```

---

## RLS ポリシー状況

### RLS 有効テーブル（セキュアモード）

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| `rakuten_travel_posts` | ✓ All | ✓ All | ✓ All | ✗ なし |
| `rakuten_travel_engagement` | ✓ All | ✓ All | ✓ All | ✗ なし |
| `rakuten_travel_posted_hotels` | ✓ All | ✓ All | ✓ All | ✗ なし |
| `rakuten_travel_settings` | ✓ All | ✓ All | ✓ All | ✗ なし |
| `travel_analytics` | ✓ All | ✓ All | ✓ All | ✗ なし |
| `hotels` | ✓ All | ✓ All | ✓ All | ✗ なし |
| `affiliate_links` | ✓ All | ✓ All | ✓ All | ✗ なし |

### RLS 無効テーブル（本番前に有効化予定）

| テーブル | ステータス | 対応 |
|---------|----------|------|
| `travel_hotels` | RLS 無効化予定 | マイグレーション実行後に有効化 |
| `travel_queue` | RLS 無効化予定 | マイグレーション実行後に有効化 |

---

## インデックス一覧

| テーブル | インデックス名 | カラム | タイプ |
|---------|--------------|--------|--------|
| rakuten_travel_posts | idx_rakuten_travel_posts_post_id | post_id | ASC |
| rakuten_travel_posts | idx_rakuten_travel_posts_hotel_id | hotel_id | ASC |
| rakuten_travel_posts | idx_rakuten_travel_posts_posted_at | posted_at | DESC |
| rakuten_travel_posts | idx_rakuten_travel_posts_created_at | created_at | DESC |
| rakuten_travel_engagement | idx_rakuten_travel_engagement_post_id | post_id | ASC |
| rakuten_travel_engagement | idx_rakuten_travel_engagement_threads_post_id | threads_post_id | ASC |
| rakuten_travel_engagement | idx_rakuten_travel_engagement_fetched_at | fetched_at | DESC |
| rakuten_travel_engagement | idx_rakuten_travel_engagement_created_at | created_at | DESC |
| rakuten_travel_posted_hotels | idx_rakuten_posted_hotels_hotel_no | hotel_no | ASC |
| rakuten_travel_posted_hotels | idx_rakuten_posted_hotels_posted_at | posted_at | DESC |
| rakuten_travel_posted_hotels | idx_rakuten_posted_hotels_post_id | post_id | ASC |
| rakuten_travel_settings | idx_rakuten_settings_key | setting_key | ASC |

---

## 容量・パフォーマンス予測

**1ヶ月間の想定投稿数（毎日1投稿の場合）**
- 投稿レコード: 30行
- エンゲージメント記録: 30行（日次1回フェッチの場合）
- 投稿済みホテル: 30行（重複なし）

**6ヶ月間の想定**
- rakuten_travel_posts: ~180行
- rakuten_travel_engagement: ~180行（日次）
- rakuten_travel_posted_hotels: ~180行

**年単位での想定**
- rakuten_travel_posts: ~365行
- rakuten_travel_engagement: ~365行 × 日次フェッチ回数（年間 13,000+ 行）

→ インデックスによる効率的なクエリが必要

---

## バックアップ・保全戦略

### 重要テーブル（毎日バックアップ）
- `rakuten_travel_posts` - 投稿履歴は削除禁止
- `rakuten_travel_posted_hotels` - 投稿済み判定の基準
- `travel_hotels` - ホテル情報キャッシュ

### 参照テーブル（月次バックアップ）
- `rakuten_travel_engagement` - 分析用（定期クリーンアップ可）
- `rakuten_travel_settings` - 設定バックアップ

### DELETE ポリシー
```
rakuten_travel_posts: DELETE 禁止（UPDATE → status = 'archived'推奨）
rakuten_travel_engagement: DELETE 許可（古いデータのクリーンアップ用）
travel_hotels: DELETE 禁止（UPDATE → status = 'inactive'推奨）
```

---

## クエリ例

### 投稿済みホテルを除外する
```sql
SELECT h.* FROM travel_hotels h
WHERE h.id NOT IN (
  SELECT DISTINCT hotel_id 
  FROM rakuten_travel_posts
  WHERE posted_at > NOW() - INTERVAL '30 days'
  AND hotel_id IS NOT NULL
)
AND h.status = 'active';
```

### エンゲージメント率上位10投稿
```sql
SELECT 
  p.post_id,
  p.hotel_name,
  e.total_engagement,
  e.impressions_count,
  e.engagement_rate,
  p.posted_at
FROM rakuten_travel_posts p
LEFT JOIN rakuten_travel_engagement e 
  ON p.post_id = e.post_id
ORDER BY e.engagement_rate DESC NULLS LAST
LIMIT 10;
```

### ホテル別投稿数・平均エンゲージメント
```sql
SELECT 
  p.hotel_name,
  COUNT(p.id) as post_count,
  ROUND(AVG(e.engagement_rate), 4) as avg_engagement_rate,
  MAX(e.posted_at) as latest_post
FROM rakuten_travel_posts p
LEFT JOIN rakuten_travel_engagement e 
  ON p.post_id = e.post_id
GROUP BY p.hotel_name
ORDER BY post_count DESC;
```

---

**最終更新:** 2026-08-09
