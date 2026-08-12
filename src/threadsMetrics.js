const axios = require('axios');
const logger = require('./logger');

const GRAPH_API_BASE = 'https://graph.threads.net';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000];

// API レート制限のトラッキング
const rateLimitState = {
  remaining: 200,
  resetTime: null,
  requestCount: 0,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (retryCount) => RETRY_DELAYS[retryCount] || 10000;

/**
 * Threads APIのレート制限状態をチェック
 * @returns {boolean} リクエスト可能ならtrue
 */
const checkRateLimit = () => {
  const now = Date.now();

  // リセット時間が過ぎていたらカウントをリセット
  if (rateLimitState.resetTime && now > rateLimitState.resetTime) {
    rateLimitState.remaining = 200;
    rateLimitState.requestCount = 0;
    rateLimitState.resetTime = null;
  }

  return rateLimitState.remaining > 0;
};

/**
 * レート制限情報を更新
 */
const updateRateLimitInfo = (headers) => {
  if (headers['x-app-rate-limit-remaining']) {
    rateLimitState.remaining = parseInt(headers['x-app-rate-limit-remaining'], 10);
  }
  if (headers['x-app-rate-limit-reset']) {
    rateLimitState.resetTime = parseInt(headers['x-app-rate-limit-reset'], 10) * 1000;
  }
  rateLimitState.requestCount += 1;
};

/**
 * レート制限の待機時間を計算
 */
const calculateWaitTime = () => {
  if (!rateLimitState.resetTime) return 0;
  const now = Date.now();
  const waitTime = Math.max(0, rateLimitState.resetTime - now);
  return waitTime;
};

/**
 * 単一の投稿のメトリクスを取得
 * @param {string} postId - 投稿ID
 * @param {string} accessToken - Threads APIアクセストークン
 * @returns {Promise<Object>} メトリクスデータ
 */
const getSinglePostMetrics = async (postId, accessToken) => {
  if (!postId || !accessToken) {
    throw new Error('postId and accessToken are required');
  }

  let lastError;

  for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    try {
      // レート制限をチェック
      if (!checkRateLimit()) {
        const waitTime = calculateWaitTime();
        logger.warn(`Rate limit reached. Waiting ${waitTime}ms before retry...`, {
          remaining: rateLimitState.remaining,
          resetTime: new Date(rateLimitState.resetTime).toISOString(),
        });
        if (retryCount < MAX_RETRIES) {
          await sleep(Math.max(5000, waitTime));
          continue;
        }
      }

      logger.info(`Fetching metrics for post ${postId} (Retry: ${retryCount}/${MAX_RETRIES})`);

      const url = `${GRAPH_API_BASE}/${postId}`;
      const fields = 'id,text,like_count,comments_count,shares_count,impressions_count';

      const response = await axios.get(url, {
        params: {
          fields,
          access_token: accessToken,
        },
        timeout: 10000,
      });

      if (!response.data || !response.data.id) {
        throw new Error('Invalid response from Threads API');
      }

      // レート制限情報を更新
      updateRateLimitInfo(response.headers);

      logger.info(`Metrics fetched successfully for post ${postId}`, {
        likes: response.data.like_count,
        comments: response.data.comments_count,
        shares: response.data.shares_count,
        impressions: response.data.impressions_count,
      });

      return {
        post_id: response.data.id,
        text: response.data.text || '',
        like_count: response.data.like_count || 0,
        comments_count: response.data.comments_count || 0,
        shares_count: response.data.shares_count || 0,
        impressions_count: response.data.impressions_count || 0,
        fetched_at: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;

      const statusCode = error.response?.status;
      const errorData = error.response?.data;

      // 認証エラーは即座に失敗
      if (statusCode === 401 || statusCode === 403) {
        logger.error(`Threads API auth error (${statusCode})`, { postId, errorData });
        throw error;
      }

      // レート制限エラーは待機して再試行
      if (statusCode === 429) {
        const resetTime = error.response?.headers['x-app-rate-limit-reset'];
        logger.warn(`Rate limited by Threads API for post ${postId}. Reset at: ${resetTime}`);

        if (retryCount < MAX_RETRIES) {
          const waitTime = resetTime ? (parseInt(resetTime, 10) * 1000 - Date.now()) : 5000;
          logger.info(`Waiting ${waitTime}ms before retry...`);
          await sleep(Math.max(1000, waitTime));
          continue;
        }
      }

      // サーバーエラーは再試行
      if (statusCode >= 500) {
        logger.warn(`Threads API server error (${statusCode}) for post ${postId}. Retrying...`, {
          errorData,
        });
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          logger.info(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
      }

      // ネットワークエラーは再試行
      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND'
      ) {
        logger.warn(`Network error for post ${postId}: ${error.code}. Retrying...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          logger.info(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
      }

      logger.error('Failed to fetch metrics for post', {
        postId,
        statusCode,
        message: error.message,
        retry: retryCount,
        errorData,
      });
    }
  }

  logger.error(`Failed to fetch metrics for post ${postId} after ${MAX_RETRIES} retries`, {
    lastError: lastError?.message,
  });

  throw lastError;
};

/**
 * 複数の投稿のメトリクスをバッチ取得
 * @param {string[]} postIds - 投稿IDの配列
 * @param {string} accessToken - Threads APIアクセストークン
 * @returns {Promise<Object[]>} メトリクスデータの配列
 */
const batchGetPostMetrics = async (postIds, accessToken) => {
  if (!Array.isArray(postIds) || postIds.length === 0) {
    throw new Error('postIds must be a non-empty array');
  }

  if (!accessToken) {
    throw new Error('accessToken is required');
  }

  logger.info(`Fetching metrics for ${postIds.length} posts`);

  const results = [];
  const errors = [];

  for (let i = 0; i < postIds.length; i++) {
    try {
      const postId = postIds[i];
      const metrics = await getSinglePostMetrics(postId, accessToken);
      results.push(metrics);

      // バッチ処理の間に遅延を入れてレート制限を回避
      if (i < postIds.length - 1) {
        await sleep(200);
      }
    } catch (error) {
      const postId = postIds[i];
      logger.error(`Failed to fetch metrics for post ${postId}`, {
        error: error.message,
      });
      errors.push({
        post_id: postId,
        error: error.message,
      });
    }
  }

  if (errors.length > 0) {
    logger.warn(`${errors.length} posts failed to fetch metrics`, { errors });
  }

  return {
    success: results,
    failed: errors,
    total: postIds.length,
    successCount: results.length,
    failureCount: errors.length,
  };
};

/**
 * ユーザーの全投稿のメトリクスを取得
 * @param {string} userId - Threads ユーザーID
 * @param {string} accessToken - Threads APIアクセストークン
 * @returns {Promise<Object[]>} メトリクスデータの配列
 */
const getUserPostsMetrics = async (userId, accessToken) => {
  if (!userId || !accessToken) {
    throw new Error('userId and accessToken are required');
  }

  let lastError;

  for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    try {
      logger.info(
        `Fetching all posts for user ${userId} (Retry: ${retryCount}/${MAX_RETRIES})`
      );

      const url = `${GRAPH_API_BASE}/${userId}/threads`;
      const fields = 'id,text,like_count,comments_count,shares_count,impressions_count';

      const response = await axios.get(url, {
        params: {
          fields,
          access_token: accessToken,
        },
        timeout: 10000,
      });

      if (!response.data || !Array.isArray(response.data.data)) {
        throw new Error('Invalid response from Threads API');
      }

      // レート制限情報を更新
      updateRateLimitInfo(response.headers);

      const posts = response.data.data.map((post) => ({
        post_id: post.id,
        text: post.text || '',
        like_count: post.like_count || 0,
        comments_count: post.comments_count || 0,
        shares_count: post.shares_count || 0,
        impressions_count: post.impressions_count || 0,
        fetched_at: new Date().toISOString(),
      }));

      logger.info(`Fetched metrics for ${posts.length} posts`);

      return posts;
    } catch (error) {
      lastError = error;

      const statusCode = error.response?.status;
      const errorData = error.response?.data;

      if (statusCode === 401 || statusCode === 403) {
        logger.error(`Threads API auth error (${statusCode})`, { errorData });
        throw error;
      }

      if (statusCode === 429) {
        logger.warn(`Rate limited by Threads API. Retrying...`);
        if (retryCount < MAX_RETRIES) {
          const resetTime = error.response?.headers['x-app-rate-limit-reset'];
          const waitTime = resetTime
            ? (parseInt(resetTime, 10) * 1000 - Date.now())
            : 5000;
          logger.info(`Waiting ${waitTime}ms before retry...`);
          await sleep(Math.max(1000, waitTime));
          continue;
        }
      }

      if (statusCode >= 500) {
        logger.warn(`Threads API server error (${statusCode}). Retrying...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          logger.info(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
      }

      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND'
      ) {
        logger.warn(`Network error: ${error.code}. Retrying...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          logger.info(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
      }

      logger.error('Failed to fetch user posts', {
        userId,
        statusCode,
        message: error.message,
        retry: retryCount,
        errorData,
      });
    }
  }

  logger.error(`Failed to fetch user posts after ${MAX_RETRIES} retries`, {
    userId,
    lastError: lastError?.message,
  });

  throw lastError;
};

/**
 * レート制限情報を取得
 */
const getRateLimitInfo = () => {
  return {
    remaining: rateLimitState.remaining,
    resetTime: rateLimitState.resetTime
      ? new Date(rateLimitState.resetTime).toISOString()
      : null,
    requestCount: rateLimitState.requestCount,
  };
};

module.exports = {
  getSinglePostMetrics,
  batchGetPostMetrics,
  getUserPostsMetrics,
  getRateLimitInfo,
  checkRateLimit,
  calculateWaitTime,
};
