# Rakuten Travel Threads - Supabase セットアップ実行チェックリスト

**作成日:** 2026-08-09  
**対象:** rakuten-travel-threads プロジェクト  
**Supabase プロジェクト:** travel_miyazaki (ID: ygqmevyetdwyebvgqcbo)

---

## ✅ Step 1: 事前確認（完了）

- [x] Supabase プロジェクト存在確認: **travel_miyazaki** (ap-southeast-1)
- [x] 既存テーブル確認:
  - [x] travel_hotels (100行)
  - [x] travel_queue (0行)
  - [x] travel_analytics (0行)
  - [x] hotels (0行)
  - [x] affiliate_links (0行)
- [x] 環境変数設定

---

## ✅ Step 2: 環境設定（完了）

### 2.1 .env ファイル更新

**状態:** ✅ 完了

以下の Supabase 認証情報を .env に追加済み：

```bash
SUPABASE_URL=https://ygqmevyetdwyebvgqcbo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncW1ldnlldGR3eWVidmdxY2JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NTEyMzIsImV4cCI6MjA5ODUyNzIzMn0.v9HYqhjRuwU2i2JMEJyAUnbiQxRHvgM61JM6A-XEBgg
SUPABASE_PUBLISHABLE_KEY=sb_publishable_EY_PVuE4slpZqIu3Y748mQ_y3ztXolM
```

### 2.2 .env.example テンプレート更新

**状態:** ✅ 完了

Supabase 設定を含めた完全な環境変数テンプレートを用意。

---

## ⏳ Step 3: Supabase マイグレーション実行（次のステップ）

### 3.1 SQL マイグレーション ファイル作成

**状態:** ✅ 完了

ファイル: `supabase-migrations.sql`

**内容:**
- `rakuten_travel_posts` テーブル作成
- `rakuten_travel_engagement` テーブル作成
- `rakuten_travel_posted_hotels` テーブル作成
- `rakuten_travel_settings` テーブル作成
- `travel_hotels` への新規カラム追加
- RLS ポリシー設定

### 3.2 マイグレーション実行方法（2つから選択）

#### オプション A: Supabase ダッシュボード（推奨）

1. **Supabase コンソールにアクセス:**
   ```
   https://supabase.com/dashboard/project/ygqmevyetdwyebvgqcbo/sql/templates
   ```

2. **「New Query」をクリック**

3. **以下の SQL をコピー＆ペースト:**
   - ファイル `supabase-migrations.sql` の全内容をコピー

4. **「Run」ボタンをクリック**

5. **実行結果を確認:**
   - エラーなく完了すれば成功
   - エラーが出た場合は、該当行を確認して修正

#### オプション B: Supabase CLI

```bash
# 1. Supabase CLI インストール（済みの場合はスキップ）
npm install -g supabase

# 2. プロジェクトにログイン
supabase link --project-ref ygqmevyetdwyebvgqcbo

# 3. マイグレーションファイルを配置
# supabase/migrations/ ディレクトリに supabase-migrations.sql をコピー

# 4. マイグレーション実行
supabase db push
```

### 3.3 マイグレーション後の確認

実行後、以下を確認してください：

```sql
-- テーブル一覧確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 新規テーブルが作成されたか確認
SELECT * FROM rakuten_travel_posts LIMIT 1;
SELECT * FROM rakuten_travel_engagement LIMIT 1;
SELECT * FROM rakuten_travel_posted_hotels LIMIT 1;
SELECT * FROM rakuten_travel_settings LIMIT 1;

-- RLS 状態確認
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename LIKE 'rakuten_%' OR tablename IN ('travel_hotels', 'travel_queue')
ORDER BY tablename;
```

---

## ⏳ Step 4: npm パッケージインストール（次のステップ）

### 4.1 現在の状態

**status:** ✅ @supabase/supabase-js は package.json に記載済み

**確認コマンド:**
```bash
cat package.json | grep supabase
```

### 4.2 インストール実行

```bash
# プロジェクトディレクトリで実行
npm install

# または特定パッケージのみ
npm install @supabase/supabase-js
```

**インストール後:**
```bash
npm ls @supabase/supabase-js
```

---

## ⏳ Step 5: コード統合（次のステップ）

### 5.1 storage.js を Supabase 統合版に更新

**現在:** JSON ファイル（posted-hotels.json）ベース  
**目標:** Supabase `rakuten_travel_posted_hotels` テーブル使用

**必要な修正:**

1. **モジュールのインポート:**
   ```javascript
   const { createClient } = require('@supabase/supabase-js');
   
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_ANON_KEY
   );
   ```

2. **getPostedHotels() を更新:**
   ```javascript
   const getPostedHotels = async () => {
     const { data, error } = await supabase
       .from('rakuten_travel_posted_hotels')
       .select('*');
     
     if (error) {
       logger.error('Failed to fetch posted hotels', { error });
       return [];
     }
     return data || [];
   };
   ```

3. **savePostedHotel() を更新:**
   ```javascript
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

4. **isHotelPosted() を更新:**
   ```javascript
   const isHotelPosted = async (hotelNo, days = 30) => {
     const cutoffDate = dayjs().subtract(days, 'day').toISOString();
     
     const { data, error } = await supabase
       .from('rakuten_travel_posted_hotels')
       .select('hotel_no')
       .eq('hotel_no', hotelNo)
       .gt('posted_at', cutoffDate);
     
     if (error) {
       logger.error('Failed to check posted hotel', { error });
       return false;
     }
     return (data?.length || 0) > 0;
   };
   ```

### 5.2 threads.js を更新（投稿情報をDB保存）

投稿成功後に `rakuten_travel_posts` にレコード保存：

```javascript
// threads.js の postToThreads 内で追加
const savePostToDatabase = async (postId, hotelInfo) => {
  const { data, error } = await supabase
    .from('rakuten_travel_posts')
    .insert({
      post_id: postId,
      content: content,
      hotel_info: hotelInfo,
      region: hotelInfo.area,
      hotel_name: hotelInfo.hotelName,
      posted_at: new Date().toISOString()
    });
  
  if (error) {
    logger.error('Failed to save post to database', { error });
    throw error;
  }
};
```

### 5.3 index.js への統合

`savePostedHotel()` を await で呼び出すように修正：

```javascript
// 現在（JSON版）
storage.savePostedHotel(bestHotel.hotelNo, bestHotel.hotelName);

// 変更後（Supabase版）
await storage.savePostedHotel(bestHotel.hotelNo, bestHotel.hotelName, keyword);
```

---

## ⏳ Step 6: テスト実行（次のステップ）

### 6.1 接続テスト

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
supabase.from('rakuten_travel_posts').select('count').then(console.log);
"
```

### 6.2 ドライランテスト

```bash
npm run dry-run
```

### 6.3 実投稿テスト

```bash
npm run test
```

---

## ⏳ Step 7: 本番運用設定（次のステップ）

### 7.1 RLS ポリシーの厳格化

**現在:** 全員読み書き可能（開発モード）  
**本番:** 適切な権限制御が必要

**推奨ポリシー:**

```sql
-- 読み取り: 全員可能（ダッシュボード用）
CREATE POLICY "posts_read_all" ON rakuten_travel_posts
  FOR SELECT USING (true);

-- 書き込み: GAS 内部用サービスロールのみ
CREATE POLICY "posts_write_service" ON rakuten_travel_posts
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
  );

-- 削除: 管理者のみ
CREATE POLICY "posts_delete_admin" ON rakuten_travel_posts
  FOR DELETE USING (
    auth.jwt() ->> 'email' = 'admin@company.com'
  );
```

### 7.2 バックアップ設定

- **Supabase ダッシュボード** → **Settings** → **Backup**
- 自動バックアップ: 有効化
- 保持期間: 30日以上

### 7.3 監視・ログ設定

```bash
# Supabase ダッシュボード → Database → Logs
# クエリログの有効化
```

---

## ⏳ Step 8: ダッシュボード構築（次のステップ）

### 8.1 分析ダッシュボード

以下のクエリを使用したダッシュボード作成を検討：

```sql
-- 投稿パフォーマンス集計
SELECT 
  DATE(p.posted_at) as date,
  COUNT(p.id) as daily_posts,
  ROUND(AVG(e.engagement_rate), 4) as avg_engagement,
  MAX(e.total_engagement) as max_engagement
FROM rakuten_travel_posts p
LEFT JOIN rakuten_travel_engagement e ON p.post_id = e.post_id
GROUP BY DATE(p.posted_at)
ORDER BY date DESC;
```

### 8.2 ホテル人気度ランキング

```sql
-- ホテル別パフォーマンス
SELECT 
  p.hotel_name,
  COUNT(p.id) as posts,
  ROUND(AVG(e.engagement_rate), 4) as engagement,
  MAX(e.total_engagement) as top_engagement
FROM rakuten_travel_posts p
LEFT JOIN rakuten_travel_engagement e ON p.post_id = e.post_id
GROUP BY p.hotel_name
ORDER BY COUNT(p.id) DESC LIMIT 20;
```

---

## 📋 作成ファイル一覧

| ファイル | 説明 | ステータス |
|---------|------|----------|
| `.env` | 環境変数（Supabase 認証情報追加済み） | ✅ 完了 |
| `.env.example` | 環境変数テンプレート | ✅ 完了 |
| `supabase-migrations.sql` | SQL マイグレーション | ✅ 完了 |
| `SUPABASE_SETUP.md` | セットアップガイド | ✅ 完了 |
| `SCHEMA_SUMMARY.md` | スキーマ詳細ドキュメント | ✅ 完了 |
| `SETUP_CHECKLIST.md` | このファイル | ✅ 完了 |

---

## 📊 テーブル作成予定

| テーブル | カラム数 | 用途 | 優先度 |
|---------|---------|------|--------|
| `rakuten_travel_posts` | 11 | 投稿履歴 | ⭐⭐⭐ |
| `rakuten_travel_engagement` | 12 | エンゲージメント | ⭐⭐⭐ |
| `rakuten_travel_posted_hotels` | 7 | 投稿済み判定 | ⭐⭐⭐ |
| `rakuten_travel_settings` | 5 | 設定管理 | ⭐⭐ |
| `travel_hotels` 拡張 | 8新規 | ホテルキャッシュ | ⭐⭐ |

---

## 🔐 セキュリティメモ

**警告:** 現在の設定は開発モード  
- RLS ポリシーが全員読み書き可能
- トークンが .env に平文保存

**本番前に:**
1. [ ] RLS ポリシーを厳格化
2. [ ] 環境変数を環境別に分離
3. [ ] バックアップ設定の確認
4. [ ] アクセスログ監視の設定

---

## 💡 トラブルシューティング

### Q. マイグレーション実行時に FK エラー

**A:** テーブル順序を確認。Foreign Key 参照先が先に作成されていることを確認：
```bash
# テーブル作成順序
1. travel_hotels (既存)
2. rakuten_travel_posts
3. rakuten_travel_engagement
4. rakuten_travel_posted_hotels
```

### Q. RLS エラー: permission denied

**A:** ポリシーの有効確認：
```sql
-- RLS ポリシー一覧
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename LIKE 'rakuten_%';
```

### Q. .env の認証キーが無効

**A:** 以下を確認：
```bash
# Supabase ダッシュボード → Settings → API
# Publishable Key (anon) と Project URL を確認
```

---

## 📅 推奨スケジュール

| 日程 | タスク |
|------|--------|
| **2026-08-09** | ✅ 環境変数・スキーマ設計完了 |
| **2026-08-10** | ⏳ SQL マイグレーション実行 |
| **2026-08-11** | ⏳ npm install・テスト実行 |
| **2026-08-12** | ⏳ storage.js 統合完了 |
| **2026-08-13** | ⏳ 本番テスト・投稿確認 |
| **2026-08-15** | ⏳ 本番環境へ移行 |

---

## 📞 参考リンク

- **Supabase ダッシュボード:** https://supabase.com/dashboard/project/ygqmevyetdwyebvgqcbo
- **Supabase JavaScript Client:** https://supabase.com/docs/reference/javascript
- **Row Level Security Guide:** https://supabase.com/docs/guides/database/postgres/row-level-security

---

**最終更新:** 2026-08-09  
**次の確認:** Step 3 (マイグレーション実行) を進めてください
