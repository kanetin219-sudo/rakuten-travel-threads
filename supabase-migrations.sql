-- ============================================================================
-- Rakuten Travel Threads - Supabase Migration
-- Created: 2026-08-09
-- Project: travel_miyazaki (ygqmevyetdwyebvgqcbo)
-- ============================================================================

-- ============================================================================
-- 1. Posts Table - Threads投稿履歴
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rakuten_travel_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL UNIQUE,  -- Threads API から返される投稿ID
  content TEXT NOT NULL,  -- 投稿テキスト（500文字以下）
  hotel_info JSONB,  -- ホテル情報（hotelNo, hotelName, area, price等を格納）
  hotel_id BIGINT REFERENCES public.travel_hotels(id) ON DELETE SET NULL,
  hotel_name TEXT,  -- ホテル名（検索用）
  region TEXT,  -- 地域（検索用）
  threads_url TEXT,  -- Threads 投稿URL
  posted_at TIMESTAMP WITH TIME ZONE,  -- 投稿日時（Threads APIレスポンス時刻）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_rakuten_travel_posts_post_id ON public.rakuten_travel_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_rakuten_travel_posts_hotel_id ON public.rakuten_travel_posts(hotel_id);
CREATE INDEX IF NOT EXISTS idx_rakuten_travel_posts_posted_at ON public.rakuten_travel_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_rakuten_travel_posts_created_at ON public.rakuten_travel_posts(created_at DESC);

-- RLS設定
ALTER TABLE public.rakuten_travel_posts ENABLE ROW LEVEL SECURITY;

-- RLSポリシー：全員読み取り可能、書き込みは無制限（GAS内部用）
CREATE POLICY IF NOT EXISTS "rakuten_travel_posts_allow_read"
  ON public.rakuten_travel_posts FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "rakuten_travel_posts_allow_insert"
  ON public.rakuten_travel_posts FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "rakuten_travel_posts_allow_update"
  ON public.rakuten_travel_posts FOR UPDATE
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. Engagement Table - Threads投稿のエンゲージメント指標
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rakuten_travel_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL UNIQUE,  -- Threads投稿ID
  threads_post_id UUID REFERENCES public.rakuten_travel_posts(id) ON DELETE CASCADE,
  likes_count INTEGER DEFAULT 0,  -- いいね数
  comments_count INTEGER DEFAULT 0,  -- コメント数
  shares_count INTEGER DEFAULT 0,  -- シェア数
  reposts_count INTEGER DEFAULT 0,  -- リポスト数
  impressions_count INTEGER DEFAULT 0,  -- インプレッション数
  total_engagement INTEGER DEFAULT 0,  -- 合計エンゲージメント = likes + comments + shares + reposts
  engagement_rate DOUBLE PRECISION DEFAULT 0,  -- エンゲージメント率 = total_engagement / impressions
  fetched_at TIMESTAMP WITH TIME ZONE,  -- 最後にフェッチした日時
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_rakuten_travel_engagement_post_id ON public.rakuten_travel_engagement(post_id);
CREATE INDEX IF NOT EXISTS idx_rakuten_travel_engagement_threads_post_id ON public.rakuten_travel_engagement(threads_post_id);
CREATE INDEX IF NOT EXISTS idx_rakuten_travel_engagement_fetched_at ON public.rakuten_travel_engagement(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_rakuten_travel_engagement_created_at ON public.rakuten_travel_engagement(created_at DESC);

-- RLS設定
ALTER TABLE public.rakuten_travel_engagement ENABLE ROW LEVEL SECURITY;

-- RLSポリシー：全員読み取り可能、書き込みは無制限（Analytics収集用）
CREATE POLICY IF NOT EXISTS "rakuten_travel_engagement_allow_read"
  ON public.rakuten_travel_engagement FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "rakuten_travel_engagement_allow_insert"
  ON public.rakuten_travel_engagement FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "rakuten_travel_engagement_allow_update"
  ON public.rakuten_travel_engagement FOR UPDATE
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. Hotels Cache Table（既存 travel_hotels を Rakuten Travel用に拡張）
-- ============================================================================
-- 既存のhotel_idカラムをhotel_noに改名して、Rakuten Travel APIの hotelNo を格納する
-- このテーブルは既に存在するので、必要に応じてカラムを追加

ALTER TABLE public.travel_hotels
  ADD COLUMN IF NOT EXISTS rakuten_hotel_no TEXT UNIQUE,  -- 楽天APIのhotelNo
  ADD COLUMN IF NOT EXISTS min_price INTEGER,  -- 最安値（1人あたり）
  ADD COLUMN IF NOT EXISTS max_price INTEGER,  -- 最高値（1人あたり）
  ADD COLUMN IF NOT EXISTS review_average DECIMAL(3,2),  -- 口コミ平均点
  ADD COLUMN IF NOT EXISTS review_count INTEGER,  -- 口コミ数
  ADD COLUMN IF NOT EXISTS catch_copy TEXT,  -- キャッチコピー
  ADD COLUMN IF NOT EXISTS feature_keywords TEXT,  -- 特徴キーワード
  ADD COLUMN IF NOT EXISTS image_url TEXT;  -- 画像URL（主画像）

-- ============================================================================
-- 4. Posted Hotels History Table（投稿済みホテル履歴）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rakuten_travel_posted_hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_no TEXT NOT NULL,  -- 楽天API hotelNo
  hotel_name TEXT NOT NULL,
  region TEXT,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  post_id TEXT REFERENCES public.rakuten_travel_posts(post_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_rakuten_posted_hotels_hotel_no ON public.rakuten_travel_posted_hotels(hotel_no);
CREATE INDEX IF NOT EXISTS idx_rakuten_posted_hotels_posted_at ON public.rakuten_travel_posted_hotels(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_rakuten_posted_hotels_post_id ON public.rakuten_travel_posted_hotels(post_id);

-- RLS設定
ALTER TABLE public.rakuten_travel_posted_hotels ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "rakuten_posted_hotels_allow_all"
  ON public.rakuten_travel_posted_hotels
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. Settings Table（プロジェクト設定）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rakuten_travel_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_rakuten_settings_key ON public.rakuten_travel_settings(setting_key);

-- RLS設定
ALTER TABLE public.rakuten_travel_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "rakuten_settings_allow_all"
  ON public.rakuten_travel_settings
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. Enable RLS on existing travel_hotels and travel_queue if not already enabled
-- ============================================================================
ALTER TABLE public.travel_hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_queue ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies if they don't exist
CREATE POLICY IF NOT EXISTS "travel_hotels_allow_read"
  ON public.travel_hotels FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "travel_hotels_allow_all_write"
  ON public.travel_hotels
  USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "travel_queue_allow_read"
  ON public.travel_queue FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "travel_queue_allow_all_write"
  ON public.travel_queue
  USING (true) WITH CHECK (true);

-- ============================================================================
-- End of Migration
-- ============================================================================
