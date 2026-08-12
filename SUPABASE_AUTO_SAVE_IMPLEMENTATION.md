# Threads 投稿時 Supabase 自動保存機能 実装完了報告

## 実装完了日時
2026-08-12

## 実装概要
Threads 投稿時に投稿内容・ホテル情報・品質スコアを自動的に Supabase に保存する機能を実装しました。

## 修正ファイル一覧

### 1. `/Users/nakurashun/Desktop/my-company/CPO（プロダクト責任者）/アウトプット/rakuten-travel-threads/src/threads.js`
**修正内容:**
- dayjs タイムゾーン機能を import
- `savePostToSupabase()` 関数を新規追加
- `postToThreadsWithSupabase()` 関数を新規追加
- モジュール exports に新関数を追加

**新規追加関数:**

#### `savePostToSupabase(supabaseClient, postData)`
Supabase の posts テーブルに投稿情報を保存

**パラメータ:**
```javascript
{
  post_id: string,           // Threads API から返却されたポスト ID
  content: string,           // 投稿テキスト（複数パート時は --- で結合）
  hotel_info: object,        // ホテル情報
  quality_score: number      // 品質スコア（0-100）
}
```

**保存されるカラム:**
- `post_id` - Threads 投稿 ID（主キー）
- `content` - 投稿本文
- `hotel_info` - ホテル情報 JSON
- `created_at` - 作成日時（JST）
- `posted_at` - 投稿日時（JST）
- `quality_score` - 品質スコア

#### `postToThreadsWithSupabase(textOrArray, threadsUserId, accessToken, supabaseClient, hotelInfo, qualityScore)`
Threads に投稿してSupabaseに自動保存（統合版）

**パラメータ:**
- `textOrArray` - 投稿テキスト（文字列 or 配列）
- `threadsUserId` - Threads ユーザーID
- `accessToken` - Threads アクセストークン
- `supabaseClient` - Supabase クライアント（null の場合は投稿のみ）
- `hotelInfo` - ホテル情報オブジェクト（オプション）
- `qualityScore` - 品質スコア（オプション）

**戻り値:**
```javascript
{
  success: boolean,
  postId: string,           // Threads 投稿 ID
  saved: boolean,           // Supabase 保存成功フラグ
  hotelName: string,        // ホテル名
  error: string            // エラーメッセージ（失敗時）
}
```

---

### 2. `/Users/nakurashun/Desktop/my-company/CPO（プロダクト責任者）/アウトプット/rakuten-travel-threads/index.js`
**修正内容:**
- 投稿処理を `threads.postToThreads()` から `threads.postToThreadsWithSupabase()` に変更
- ホテル情報と品質スコアを threads.js に渡す処理を追加
- エラー処理を追加

**修正箇所:**
```javascript
// 修正前：投稿のみ
const postId = await threads.postToThreads([postText1, postText2], ...)

// 修正後：投稿 + Supabase 自動保存
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
```

---

## 環境設定

### 必要な環境変数（既に設定済み）
`.env` ファイルに以下を設定してください（.env.example に記載済み）：

```bash
# Supabase（オプション - 投稿を Supabase に保存する場合）
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJxxxx...
```

### Supabase のテーブル作成

以下の SQL で posts テーブルを作成してください：

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

-- インデックス作成（検索高速化用）
CREATE INDEX posts_created_at_idx ON posts(created_at DESC);
CREATE INDEX posts_quality_score_idx ON posts(quality_score DESC);

-- RLS ポリシー（必要に応じて設定）
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON posts
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

---

## データベース仕様

### posts テーブルスキーマ

| カラム名 | 型 | 説明 | 例 |
|---------|-----|------|-----|
| `post_id` | TEXT (PK) | Threads 投稿 ID | `12345678901234567` |
| `content` | TEXT | 投稿本文（複数パート時は --- で結合） | `マジ？湯布院でこの値段...` |
| `hotel_info` | JSONB | ホテル情報 | `{"hotelNo": "123", "hotelName": "xxx", ...}` |
| `created_at` | TIMESTAMP | 作成日時（JST） | `2026-08-12 19:30:45+09` |
| `posted_at` | TIMESTAMP | 投稿日時（JST） | `2026-08-12 19:30:45+09` |
| `quality_score` | INTEGER | 品質スコア（0-100） | `92` |
| `updated_at` | TIMESTAMP | 更新日時 | `2026-08-12 19:30:45+09` |

### hotel_info JSON 構造

```json
{
  "hotelNo": "12345",
  "hotelName": "温泉旅館 由布院",
  "area": "由布院",
  "minPrice": 12000,
  "maxPrice": 25000,
  "catchCopy": "由布岳を眺める温泉宿",
  "reviewAverage": 4.5,
  "reviewCount": 250,
  "affiliateUrl": "https://rakuten.co.jp/affiliate/xxx"
}
```

---

## テスト方法

### 1. 環境構築確認
```bash
npm test  # または node index.js --check
```

### 2. ドライラン（投稿なし、品質チェックのみ）
```bash
npm run dry-run  # または node index.js --dry-run
```

### 3. 実際の投稿テスト（1回投稿）
```bash
npm run post  # または node index.js --now
```

**期待される動作:**
1. ホテル検索 → 品質ゲートキーパーチェック
2. Threads に 2パート投稿
3. 投稿成功後、Supabase posts テーブルに以下が保存される：
   - `post_id`: Threads API から返却された ID
   - `content`: 投稿テキスト（両パート）
   - `hotel_info`: ホテル情報 JSON
   - `quality_score`: 品質スコア（例：92/100）
   - `created_at`, `posted_at`: 現在時刻（JST）

### 4. Supabase で確認
```
Supabase ダッシュボード → SQL Editor → 
SELECT * FROM posts ORDER BY created_at DESC LIMIT 1;
```

---

## 動作フロー図

```
index.js (runDailyPost)
  ├─ ホテル検索
  ├─ 投稿文生成（Part1, Part2）
  ├─ 品質ゲートキーパーチェック
  │  └─ 不合格時は投稿中止
  └─ threads.postToThreadsWithSupabase()
     ├─ threads.postToThreads()
     │  ├─ Part1 投稿
     │  └─ Part2 投稿（リプライ）
     │     └─ 成功時に post_id を取得
     └─ threads.savePostToSupabase()
        ├─ Supabase posts テーブルに UPSERT
        └─ ホテル情報と品質スコアを保存
```

---

## エラー処理

### Supabase 保存失敗時
- 投稿自体は成功している
- ログに警告が記録される
- アプリケーションは正常に続行

### ネットワーク障害時
- 3回まで自動リトライ
- リトライ失敗時はエラーを記録

---

## ログ出力例

```
✅ Post published successfully (All gatekeepers approved)
   postId: 17841234567890123
   hotelName: 温泉旅館 由布院
   area: 由布院

Saving post to Supabase (post_id: 17841234567890123)
Post saved successfully to Supabase
   postId: 17841234567890123
   qualityScore: 92
   hotelName: 温泉旅館 由布院
```

---

## トラブルシューティング

### Supabase に保存されない場合

**原因:** 環境変数が未設定
```
SUPABASE_URL と SUPABASE_KEY が設定されていることを確認
```

**確認コマンド:**
```bash
echo $SUPABASE_URL
echo $SUPABASE_KEY
```

### テーブルが見つからないエラー

```
Error: relation "posts" does not exist
```

**解決方法:**
Supabase SQL Editor で上記のテーブル作成 SQL を実行してください。

### RLS ポリシーエラー

```
Error: new row violates row-level security policy
```

**解決方法:**
Supabase ダッシュボード → Authentication → RLS で「Allow all access」ポリシーが有効か確認

---

## 次のステップ

### 実装済み機能
- ✅ 投稿時の自動 Supabase 保存
- ✅ ホテル情報の JSON 保存
- ✅ 品質スコアの記録
- ✅ エラーハンドリング
- ✅ ログ出力

### 今後の拡張可能性
- 投稿のメトリクス（いいね・コメント数）の定期取得
- ホテル別投稿パフォーマンス分析
- A/B テスト結果の記録
- 投稿時間別の成績分析

---

## 参考資料

- 修正済みファイル：
  - `/Users/nakurashun/Desktop/my-company/CPO（プロダクト責任者）/アウトプット/rakuten-travel-threads/src/threads.js`
  - `/Users/nakurashun/Desktop/my-company/CPO（プロダクト責任者）/アウトプット/rakuten-travel-threads/index.js`
  
- 環境設定：
  - `/Users/nakurashun/Desktop/my-company/CPO（プロダクト責任者）/アウトプット/rakuten-travel-threads/.env.example`

---

実装完了。投稿するたびに Supabase に自動保存されるようになったやが。
