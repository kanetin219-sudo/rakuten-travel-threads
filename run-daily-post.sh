#!/bin/bash

# Rakuten Travel → Threads Auto-Post Script
# 毎日19時に自動実行

cd "/Users/nakurashun/Desktop/my-company/CPO（プロダクト責任者）/アウトプット/rakuten-travel-threads"

# ログディレクトリを確保
mkdir -p ~/Library/Logs

# 環境変数を読み込む
export $(cat .env | xargs)

# 投稿実行
npm run start -- --now

# ログに記録
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Post executed" >> ~/Library/Logs/rakuten-threads-post.log
