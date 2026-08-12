const axios = require('axios');
const logger = require('./logger');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const GRAPH_API_BASE = 'https://graph.threads.net';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (retryCount) => RETRY_DELAYS[retryCount] || 10000;

const createThreadsContainer = async (text, threadsUserId, accessToken, parentId = null) => {
  if (!threadsUserId || !accessToken) {
    logger.error('Missing Threads API credentials');
    throw new Error('THREADS_USER_ID or THREADS_ACCESS_TOKEN not set');
  }

  if (!text || text.length === 0) {
    logger.error('Post text is empty');
    throw new Error('Post text cannot be empty');
  }

  if (text.length > 500) {
    logger.error('Post text exceeds 500 character limit', { length: text.length });
    throw new Error('Post text exceeds maximum length (500 characters)');
  }

  let lastError;

  for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    try {
      logger.info(`Creating Threads container (Retry: ${retryCount}/${MAX_RETRIES})`);

      const url = `${GRAPH_API_BASE}/${threadsUserId}/threads`;
      const payload = { text, media_type: 'TEXT' };

      if (parentId) {
        payload.reply_to_id = parentId;
        logger.info(`Creating reply to parent thread: ${parentId}`);
      }

      const response = await axios.post(
        url,
        payload,
        {
          params: { access_token: accessToken },
          timeout: 10000,
        }
      );

      if (!response.data || !response.data.id) {
        logger.error('Invalid response from Threads API (container creation)', { response: response.data });
        throw new Error('No container ID returned from Threads API');
      }

      logger.info(`Container created successfully: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      lastError = error;

      const statusCode = error.response?.status;
      const errorData = error.response?.data;

      if (statusCode === 401) {
        logger.error('Threads API authentication error (401)', {
          message: error.message,
          errorData
        });
        throw error;
      }

      if (statusCode === 403) {
        logger.error('Threads API permission denied (403)', {
          message: error.message,
          errorData
        });
        throw error;
      }

      if (statusCode === 429) {
        logger.warn(`Rate limited by Threads API. Retrying after delay...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          logger.info(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
      }

      if (statusCode >= 500) {
        logger.warn(`Threads API server error (${statusCode}). Retrying...`, { errorData });
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          logger.info(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        logger.warn(`Network error: ${error.code}. Retrying...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          logger.info(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
      }

      logger.error('Threads container creation error', {
        statusCode,
        message: error.message,
        retry: retryCount,
        errorData
      });
    }
  }

  logger.error(`Failed to create container after ${MAX_RETRIES} retries`, {
    lastError: lastError?.message
  });

  throw lastError;
};

const publishThreadsPost = async (containerId, threadsUserId, accessToken) => {
  if (!containerId) {
    logger.error('Container ID is missing');
    throw new Error('Container ID is required for publishing');
  }

  if (!threadsUserId || !accessToken) {
    logger.error('Missing Threads API credentials for publishing');
    throw new Error('THREADS_USER_ID or THREADS_ACCESS_TOKEN not set');
  }

  let lastError;

  for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    try {
      logger.info(`Publishing Threads post (Retry: ${retryCount}/${MAX_RETRIES})`);

      const url = `${GRAPH_API_BASE}/${threadsUserId}/threads_publish`;
      const response = await axios.post(
        url,
        { creation_id: containerId },
        {
          params: { access_token: accessToken },
          timeout: 10000,
        }
      );

      if (!response.data || !response.data.id) {
        logger.error('Invalid response from Threads API (publishing)', { response: response.data });
        throw new Error('No post ID returned from Threads API');
      }

      logger.success(`Post published successfully: ${response.data.id}`);
      return response.data.id;
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
          const delay = getRetryDelay(retryCount);
          await sleep(delay);
          continue;
        }
      }

      if (statusCode >= 500) {
        logger.warn(`Threads API server error (${statusCode}). Retrying...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          await sleep(delay);
          continue;
        }
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        logger.warn(`Network error: ${error.code}. Retrying...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          await sleep(delay);
          continue;
        }
      }

      logger.error('Threads publishing error', {
        containerId,
        statusCode,
        message: error.message,
        retry: retryCount,
        errorData
      });
    }
  }

  logger.error(`Failed to publish after ${MAX_RETRIES} retries`, {
    containerId,
    lastError: lastError?.message
  });

  throw lastError;
};

const splitTextForThreads = (text, maxChars = 500) => {
  const parts = [];
  let current = '';

  const lines = text.split('\n');

  for (const line of lines) {
    if ((current + (current ? '\n' : '') + line).length > maxChars) {
      if (current) parts.push(current.trim());
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }

  if (current) parts.push(current.trim());

  return parts;
};

const postToThreads = async (textOrArray, threadsUserId, accessToken) => {
  try {
    let parts;

    if (Array.isArray(textOrArray)) {
      parts = textOrArray;
    } else {
      parts = splitTextForThreads(textOrArray, 500);
    }

    if (parts.length === 0) {
      throw new Error('No text to post');
    }

    let rootPostId = null;

    for (let i = 0; i < parts.length; i++) {
      const partText = parts[i];
      logger.info(`Posting thread part ${i + 1}/${parts.length} (${partText.length} chars)`);

      const parentId = i === 0 ? null : rootPostId;
      const containerId = await createThreadsContainer(partText, threadsUserId, accessToken, parentId);
      const postId = await publishThreadsPost(containerId, threadsUserId, accessToken);

      if (i === 0) {
        rootPostId = postId;
        logger.info(`Root post created: ${rootPostId}`);
      } else {
        logger.info(`Reply posted: ${postId} (part ${i + 1})`);
      }
    }

    return rootPostId;
  } catch (error) {
    logger.error('Failed to post to Threads', { error: error.message });
    throw error;
  }
};

/**
 * Supabase に投稿情報を保存
 */
const savePostToSupabase = async (supabaseClient, postData) => {
  if (!supabaseClient) {
    logger.warn('Supabase client not provided. Post information will not be saved to database.');
    return null;
  }

  try {
    const {
      post_id,
      content,
      hotel_info,
      quality_score,
    } = postData;

    if (!post_id || !content) {
      logger.error('Missing required post data for Supabase save', {
        post_id,
        contentLength: content?.length,
      });
      return null;
    }

    const now = dayjs().tz('Asia/Tokyo').toISOString();

    logger.info(`Saving post to Supabase (post_id: ${post_id})`);

    const { data, error } = await supabaseClient
      .from('posts')
      .upsert([
        {
          post_id,
          content,
          hotel_info: hotel_info || null,
          created_at: now,
          posted_at: now,
          quality_score: quality_score || null,
        },
      ], { onConflict: 'post_id' });

    if (error) {
      logger.error('Failed to save post to Supabase', {
        postId: post_id,
        error: error.message,
        details: error.details,
      });
      return null;
    }

    logger.info(`Post saved successfully to Supabase`, {
      postId: post_id,
      qualityScore: quality_score,
      hotelName: hotel_info?.hotelName || 'N/A',
    });

    return data;
  } catch (error) {
    logger.error('Error saving post to Supabase', {
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
};

/**
 * Threads に投稿してSupabaseに保存（統合版）
 */
const postToThreadsWithSupabase = async (
  textOrArray,
  threadsUserId,
  accessToken,
  supabaseClient,
  hotelInfo = null,
  qualityScore = null
) => {
  try {
    // まず Threads に投稿
    const rootPostId = await postToThreads(textOrArray, threadsUserId, accessToken);

    if (!rootPostId) {
      logger.error('Failed to get post ID after posting to Threads');
      return { success: false, postId: null, error: 'No post ID returned' };
    }

    // 投稿内容を組み立て（複数パートの場合は結合）
    let fullContent;
    if (Array.isArray(textOrArray)) {
      fullContent = textOrArray.join('\n\n---\n\n');
    } else {
      fullContent = textOrArray;
    }

    // Supabase に保存
    const supabaseData = {
      post_id: rootPostId,
      content: fullContent,
      hotel_info: hotelInfo,
      quality_score: qualityScore,
    };

    const savedData = await savePostToSupabase(supabaseClient, supabaseData);

    return {
      success: true,
      postId: rootPostId,
      saved: savedData !== null,
      hotelName: hotelInfo?.hotelName || 'N/A',
    };
  } catch (error) {
    logger.error('Failed in postToThreadsWithSupabase', {
      error: error.message,
      hotelName: hotelInfo?.hotelName || 'unknown',
    });
    return { success: false, postId: null, error: error.message };
  }
};

module.exports = {
  createThreadsContainer,
  publishThreadsPost,
  postToThreads,
  postToThreadsWithSupabase,
  splitTextForThreads,
  savePostToSupabase,
};
