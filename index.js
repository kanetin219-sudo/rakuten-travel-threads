require('dotenv').config();
const logger = require('./src/logger');
const rakuten = require('./src/rakuten');
const threads = require('./src/threads');
const threadsMetrics = require('./src/threadsMetrics');
const postGenerator = require('./src/postGenerator');
const storage = require('./src/storage');
const scheduler = require('./src/scheduler');
const qualityChecker = require('./src/qualityChecker');
const { QualityGatekeepersSystem } = require('./src/qualityGatekeepers');
const { closeBrowser } = require('./src/urlShortener');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const dayOfYear = require('dayjs/plugin/dayOfYear');
const { createClient } = require('@supabase/supabase-js');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(dayOfYear);

const MOCK_HOTELS = [
  {
    hotelNo: 'mock001',
    hotelName: 'モック温泉旅館 由布院',
    hotelAddress: '大分県由布市湯布院町',
    area: '由布院',
    catchCopy: '由布岳を眺める温泉宿',
    featureKeywords: '温泉, 地元食材',
    reviewAverage: 4.5,
    reviewCount: 250,
    images: [{ imageUrl: 'https://example.com/mock1.jpg' }],
    minPrice: 12000,
    maxPrice: 25000,
    reservationUrl: 'https://example.com',
    affiliateUrl: 'https://rakuten.co.jp/affiliate/mock001',
  },
  {
    hotelNo: 'mock002',
    hotelName: 'グランピング別府',
    hotelAddress: '大分県別府市',
    area: '別府',
    catchCopy: 'モダンなグランピング施設',
    featureKeywords: 'グランピング, アクティビティ',
    reviewAverage: 4.3,
    reviewCount: 180,
    images: [{ imageUrl: 'https://example.com/mock2.jpg' }],
    minPrice: 15000,
    maxPrice: 30000,
    reservationUrl: 'https://example.com',
    affiliateUrl: 'https://rakuten.co.jp/affiliate/mock002',
  },
];

const getEnvironmentVariables = () => {
  const vars = {
    RAKUTEN_APPLICATION_ID: process.env.RAKUTEN_APPLICATION_ID,
    RAKUTEN_ACCESS_KEY: process.env.RAKUTEN_ACCESS_KEY,
    RAKUTEN_AFFILIATE_ID: process.env.RAKUTEN_AFFILIATE_ID,
    THREADS_USER_ID: process.env.THREADS_USER_ID,
    THREADS_ACCESS_TOKEN: process.env.THREADS_ACCESS_TOKEN,
    SEARCH_KEYWORDS: process.env.SEARCH_KEYWORDS || 'rakuten,travel,hotel',
    TIMEZONE: process.env.TIMEZONE || 'Asia/Tokyo',
    POST_HOUR: parseInt(process.env.POST_HOUR || '19', 10),
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
  };

  return vars;
};

// Supabase クライアントを初期化（オプション）
let supabaseClient = null;

const initSupabase = () => {
  const env = getEnvironmentVariables();

  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
    logger.warn('Supabase credentials not configured. Metrics will not be saved to database.');
    return null;
  }

  try {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    logger.info('Supabase client initialized successfully');
    return supabaseClient;
  } catch (error) {
    logger.error('Failed to initialize Supabase client', { error: error.message });
    return null;
  }
};

/**
 * メトリクスデータを Supabase に保存
 */
const saveMetricsToSupabase = async (postId, metrics) => {
  if (!supabaseClient) {
    logger.warn('Supabase client not initialized. Skipping metrics save.');
    return null;
  }

  try {
    logger.info(`Saving metrics to Supabase for post ${postId}`);

    const { data, error } = await supabaseClient
      .from('engagement')
      .upsert([
        {
          post_id: postId,
          like_count: metrics.like_count,
          comments_count: metrics.comments_count,
          shares_count: metrics.shares_count,
          impressions_count: metrics.impressions_count,
          fetched_at: metrics.fetched_at,
        },
      ], { onConflict: 'post_id' });

    if (error) {
      logger.error('Failed to save metrics to Supabase', {
        postId,
        error: error.message,
      });
      return null;
    }

    logger.info(`Metrics saved successfully for post ${postId}`, {
      likes: metrics.like_count,
      comments: metrics.comments_count,
      shares: metrics.shares_count,
      impressions: metrics.impressions_count,
    });

    return data;
  } catch (error) {
    logger.error('Error saving metrics to Supabase', {
      postId,
      error: error.message,
    });
    return null;
  }
};

/**
 * ユーザーの全投稿のメトリクスを取得して Supabase に保存
 */
const fetchAndSaveAllPostMetrics = async () => {
  const env = getEnvironmentVariables();

  if (!env.THREADS_USER_ID || !env.THREADS_ACCESS_TOKEN) {
    logger.error('Threads credentials not configured');
    return { success: false, error: 'Threads credentials not configured' };
  }

  try {
    logger.info('Fetching metrics for all posts...');

    const posts = await threadsMetrics.getUserPostsMetrics(
      env.THREADS_USER_ID,
      env.THREADS_ACCESS_TOKEN
    );

    if (!posts || posts.length === 0) {
      logger.warn('No posts found');
      return { success: true, postsCount: 0 };
    }

    logger.info(`Found ${posts.length} posts to fetch metrics for`);

    let savedCount = 0;
    const failedPosts = [];

    for (const post of posts) {
      try {
        if (supabaseClient) {
          await saveMetricsToSupabase(post.post_id, post);
          savedCount += 1;
        } else {
          logger.info(`Metrics for post ${post.post_id}:`, {
            likes: post.like_count,
            comments: post.comments_count,
            shares: post.shares_count,
            impressions: post.impressions_count,
          });
          savedCount += 1;
        }
      } catch (error) {
        logger.error(`Failed to process post ${post.post_id}`, {
          error: error.message,
        });
        failedPosts.push(post.post_id);
      }
    }

    logger.info(`Metrics fetch completed`, {
      totalPosts: posts.length,
      savedCount,
      failedCount: failedPosts.length,
    });

    return {
      success: true,
      totalPosts: posts.length,
      savedCount,
      failedCount: failedPosts.length,
      failedPosts,
    };
  } catch (error) {
    logger.error('Failed to fetch and save all post metrics', {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

const getSearchKeywords = () => {
  const envVars = getEnvironmentVariables();
  return envVars.SEARCH_KEYWORDS.split(',').map((k) => k.trim()).filter(Boolean);
};

const getKeywordForToday = () => {
  const keywords = getSearchKeywords();
  if (keywords.length === 0) return 'travel';

  const today = dayjs().tz('Asia/Tokyo');
  const dayOfYear = today.dayOfYear();

  return keywords[dayOfYear % keywords.length];
};

const selectBestHotel = (hotels, isPosted = false) => {
  if (!hotels || hotels.length === 0) {
    return null;
  }

  const env = getEnvironmentVariables();
  const maxHotelPrice = parseInt(env.MAX_HOTEL_PRICE) || 25000;

  // 価格上限でフィルタ（1人あたり）
  const filteredHotels = hotels.filter(hotel => hotel.minPrice && hotel.minPrice <= maxHotelPrice);

  if (filteredHotels.length === 0) {
    logger.warn(`No hotels found within price limit (${maxHotelPrice}yen)`, { hotelCount: hotels.length });
    return null;
  }

  const scored = filteredHotels.map((hotel) => ({
    hotel,
    score: rakuten.calculateHotelScore(hotel, isPosted),
  }));

  scored.sort((a, b) => b.score - a.score);

  if (scored.length > 0 && scored[0].score >= 0) {
    return scored[0].hotel;
  }

  return null;
};

const runDailyPost = async (options = {}) => {
  const { dryRun = false, now = false } = options;
  const env = getEnvironmentVariables();

  const timestamp = dayjs().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss Z');
  logger.info('='.repeat(60));
  logger.info(`Daily post execution started`, { timestamp, dryRun, now });

  try {
    const keyword = getKeywordForToday();
    logger.info(`Selected keyword: ${keyword}`);

    let hotels = [];

    if (!env.RAKUTEN_APPLICATION_ID || !env.RAKUTEN_ACCESS_KEY || !env.RAKUTEN_AFFILIATE_ID) {
      logger.warn('Rakuten credentials not found. Using mock data for testing...');
      hotels = MOCK_HOTELS;
    } else {
      hotels = await rakuten.searchHotels(keyword, {
        applicationId: env.RAKUTEN_APPLICATION_ID,
        accessKey: env.RAKUTEN_ACCESS_KEY,
        affiliateId: env.RAKUTEN_AFFILIATE_ID,
        hits: 30,
      });
    }

    if (!hotels || hotels.length === 0) {
      logger.error('No hotels found');
      return { success: false, error: 'No hotels found' };
    }

    logger.info(`Found ${hotels.length} hotels`);

    let selectedHotel = selectBestHotel(hotels);

    if (!selectedHotel) {
      logger.warn('No hotel with good score found. Trying alternate keywords...');

      for (const altKeyword of getSearchKeywords()) {
        if (altKeyword === keyword) continue;

        logger.info(`Trying alternate keyword: ${altKeyword}`);

        let altHotels = [];
        if (env.RAKUTEN_APPLICATION_ID && env.RAKUTEN_ACCESS_KEY && env.RAKUTEN_AFFILIATE_ID) {
          altHotels = await rakuten.searchHotels(altKeyword, {
            applicationId: env.RAKUTEN_APPLICATION_ID,
            accessKey: env.RAKUTEN_ACCESS_KEY,
            affiliateId: env.RAKUTEN_AFFILIATE_ID,
            hits: 30,
          });
        } else {
          altHotels = MOCK_HOTELS;
        }

        if (altHotels && altHotels.length > 0) {
          selectedHotel = selectBestHotel(altHotels);
          if (selectedHotel) break;
        }
      }
    }

    if (!selectedHotel) {
      logger.error('No suitable hotel found after trying all keywords');
      return { success: false, error: 'No suitable hotel found' };
    }

    if (storage.isHotelPosted(selectedHotel.hotelNo)) {
      logger.warn(`Hotel ${selectedHotel.hotelName} was posted in the last 30 days`);

      const alternativeHotels = hotels.filter((h) => !storage.isHotelPosted(h.hotelNo));
      if (alternativeHotels.length > 0) {
        selectedHotel = selectBestHotel(alternativeHotels);
        logger.info(`Using alternative hotel: ${selectedHotel.hotelName}`);
      } else {
        logger.error('All hotels have been posted recently');
        return { success: false, error: 'All hotels already posted' };
      }
    }

    if (!selectedHotel.affiliateUrl) {
      logger.error('Selected hotel has no affiliate URL', { hotelName: selectedHotel.hotelName });
      return { success: false, error: 'No affiliate URL available' };
    }

    const postText1 = postGenerator.generateThreadsPostPart1(selectedHotel);
    const postText2 = postGenerator.generateThreadsPostPart2(selectedHotel);

    logger.info('Generated post texts', {
      hotelName: selectedHotel.hotelName,
      part1Chars: postText1.length,
      part2Chars: postText2.length,
    });

    // 4人の調査員による品質門番チェック
    const gatekeepersSystem = new QualityGatekeepersSystem();
    const gatekeeperResult = await gatekeepersSystem.validate(postText1, postText2, selectedHotel);

    if (dryRun) {
      logger.info('DRY RUN: Post would be published', {
        hotelName: selectedHotel.hotelName,
        area: selectedHotel.area,
        affiliateUrl: selectedHotel.affiliateUrl,
        gatekeeperScore: gatekeeperResult.averageScore,
        gatekeeperPassed: gatekeeperResult.allPassed,
      });

      console.log('\n' + '='.repeat(60));
      console.log('📋 DRY RUN: Generated Thread (1/2)');
      console.log('='.repeat(60));
      console.log(postText1);
      console.log('='.repeat(60));
      console.log('\n📋 DRY RUN: Generated Thread (2/2)');
      console.log('='.repeat(60));
      console.log(postText2);
      console.log('='.repeat(60));
      console.log(`Hotel: ${selectedHotel.hotelName}`);
      console.log(`Area: ${selectedHotel.area}`);
      console.log('\n🔍 Quality Gatekeepers Audit');
      console.log('='.repeat(60));
      console.log(`Total Score: ${gatekeeperResult.averageScore}/${gatekeeperResult.maxScore}`);
      console.log(`Status: ${gatekeeperResult.allPassed ? '✅ ALL PASSED' : '❌ FAILED'}`);
      console.log(`Approval: ${gatekeeperResult.summary.passed}/${gatekeeperResult.summary.total} gatekeepers`);

      console.log('\nGatekeeper Results:');
      gatekeeperResult.gatekeepers.forEach(gk => {
        console.log(`  ${gk.passed ? '✅' : '❌'} ${gk.gatekeeper}: ${gk.score}/100`);
      });

      if (gatekeeperResult.summary.allIssues.length > 0) {
        console.log('\n⚠️ Issues to address:');
        gatekeeperResult.summary.allIssues.forEach(issue => {
          console.log(`  • ${issue}`);
        });
      }
      console.log('='.repeat(60) + '\n');

      return { success: true, dryRun: true, hotelName: selectedHotel.hotelName, gatekeeperPassed: gatekeeperResult.allPassed };
    }

    // 4人の調査員全員に合格されないと投稿しない
    if (!gatekeeperResult.allPassed) {
      logger.warn(`Post rejected by gatekeepers (${gatekeeperResult.averageScore}/${gatekeeperResult.maxScore})`, {
        hotelName: selectedHotel.hotelName,
        failedGatekeepers: gatekeeperResult.summary.failedGatekeepers,
        issues: gatekeeperResult.summary.allIssues,
      });

      console.log('\n' + '='.repeat(60));
      console.log('❌ Quality audit FAILED - Post not published');
      console.log('='.repeat(60));
      console.log(`Score: ${gatekeeperResult.averageScore}/${gatekeeperResult.maxScore}`);
      console.log(`Approval: ${gatekeeperResult.summary.passed}/${gatekeeperResult.summary.total} gatekeepers`);

      console.log('\nRejected by:');
      gatekeeperResult.summary.failedGatekeepers.forEach(gk => {
        console.log(`  ❌ ${gk}`);
      });

      console.log('\n⚠️ Issues that must be fixed:');
      gatekeeperResult.summary.allIssues.forEach(issue => {
        console.log(`  • ${issue}`);
      });
      console.log('='.repeat(60) + '\n');

      return { success: false, error: 'Gatekeepers rejected post', score: gatekeeperResult.averageScore };
    }

    if (!env.THREADS_USER_ID || !env.THREADS_ACCESS_TOKEN) {
      logger.error('Threads credentials not configured');
      console.log('\n' + '='.repeat(60));
      console.log('⚠️  Threads credentials not configured');
      console.log('Set THREADS_USER_ID and THREADS_ACCESS_TOKEN in .env');
      console.log('='.repeat(60) + '\n');
      return { success: false, error: 'Threads credentials not configured' };
    }

    // Threads に投稿して Supabase に保存
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

    if (!postResult.success) {
      logger.error('Failed to post to Threads with Supabase save', {
        error: postResult.error,
        hotelName: selectedHotel.hotelName,
      });
      return { success: false, error: postResult.error || 'Failed to post to Threads' };
    }

    const postId = postResult.postId;
    storage.savePostedHotel(selectedHotel.hotelNo, selectedHotel.hotelName);

    logger.success(`Post published successfully (All gatekeepers approved)`, {
      postId,
      hotelName: selectedHotel.hotelName,
      hotelNo: selectedHotel.hotelNo,
      area: selectedHotel.area,
      gatekeeperScore: gatekeeperResult.averageScore,
    });

    // 投稿後、メトリクスを取得して Supabase に保存
    try {
      logger.info('Fetching metrics for newly posted content...');
      const metrics = await threadsMetrics.getSinglePostMetrics(
        postId,
        env.THREADS_ACCESS_TOKEN
      );

      if (supabaseClient) {
        await saveMetricsToSupabase(postId, metrics);
      } else {
        logger.info('Initial metrics (Supabase not configured):', {
          postId,
          likes: metrics.like_count,
          comments: metrics.comments_count,
          shares: metrics.shares_count,
          impressions: metrics.impressions_count,
        });
      }
    } catch (error) {
      logger.warn('Failed to fetch initial metrics for new post', {
        postId,
        error: error.message,
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Post published successfully!');
    console.log('='.repeat(60));
    console.log(`Post ID: ${postId}`);
    console.log(`Hotel: ${selectedHotel.hotelName}`);
    console.log(`Area: ${selectedHotel.area}`);
    console.log(`Quality Score: ${gatekeeperResult.averageScore}/${gatekeeperResult.maxScore}`);
    console.log(`Approval: 4/4 gatekeepers ✅`);
    console.log('='.repeat(60) + '\n');

    return {
      success: true,
      postId,
      hotelName: selectedHotel.hotelName,
      hotelNo: selectedHotel.hotelNo,
      gatekeeperScore: gatekeeperResult.averageScore,
    };
  } catch (error) {
    logger.error('Daily post execution failed', { error: error.message, stack: error.stack });
    console.log('\n' + '='.repeat(60));
    console.log('❌ Error during post');
    console.log(`${error.message}`);
    console.log('='.repeat(60) + '\n');
    return { success: false, error: error.message };
  }
};

const checkConnectivity = async () => {
  const env = getEnvironmentVariables();

  console.log('\n' + '='.repeat(60));
  console.log('🔍 Checking environment and connectivity...');
  console.log('='.repeat(60));

  let allGood = true;

  if (!env.RAKUTEN_APPLICATION_ID) {
    console.log('❌ RAKUTEN_APPLICATION_ID not set');
    allGood = false;
  } else {
    console.log('✅ RAKUTEN_APPLICATION_ID configured');
  }

  if (!env.RAKUTEN_ACCESS_KEY) {
    console.log('❌ RAKUTEN_ACCESS_KEY not set');
    allGood = false;
  } else {
    console.log('✅ RAKUTEN_ACCESS_KEY configured');
  }

  if (!env.RAKUTEN_AFFILIATE_ID) {
    console.log('❌ RAKUTEN_AFFILIATE_ID not set');
    allGood = false;
  } else {
    console.log('✅ RAKUTEN_AFFILIATE_ID configured');
  }

  if (!env.THREADS_USER_ID) {
    console.log('⚠️  THREADS_USER_ID not set (needed for posting)');
  } else {
    console.log('✅ THREADS_USER_ID configured');
  }

  if (!env.THREADS_ACCESS_TOKEN) {
    console.log('⚠️  THREADS_ACCESS_TOKEN not set (needed for posting)');
  } else {
    console.log('✅ THREADS_ACCESS_TOKEN configured');
  }

  if (!env.SUPABASE_URL) {
    console.log('⚠️  SUPABASE_URL not set (optional - needed to save metrics)');
  } else {
    console.log('✅ SUPABASE_URL configured');
  }

  if (!env.SUPABASE_KEY) {
    console.log('⚠️  SUPABASE_KEY not set (optional - needed to save metrics)');
  } else {
    console.log('✅ SUPABASE_KEY configured');
  }

  console.log(`\n📝 Search Keywords: ${getSearchKeywords().join(', ')}`);
  console.log(`📍 Timezone: ${env.TIMEZONE}`);
  console.log(`⏰ Post Hour: ${env.POST_HOUR}:00`);
  console.log(`📅 Today's Keyword: ${getKeywordForToday()}`);

  try {
    const keyword = getKeywordForToday();
    if (env.RAKUTEN_APPLICATION_ID && env.RAKUTEN_ACCESS_KEY && env.RAKUTEN_AFFILIATE_ID) {
      console.log(`\n🔗 Testing Rakuten API connection with keyword: "${keyword}"...`);
      const hotels = await rakuten.searchHotels(keyword, {
        applicationId: env.RAKUTEN_APPLICATION_ID,
        accessKey: env.RAKUTEN_ACCESS_KEY,
        affiliateId: env.RAKUTEN_AFFILIATE_ID,
        hits: 5,
      });

      if (hotels && hotels.length > 0) {
        console.log(`✅ Rakuten API: Got ${hotels.length} hotels`);
        console.log(`   Sample: ${hotels[0].hotelName} (${hotels[0].area})`);
      } else {
        console.log(`⚠️  Rakuten API: No hotels found`);
      }
    } else {
      console.log(`\n⚠️  Rakuten API credentials not configured, using mock data for testing`);
      console.log(`   Sample mock hotels: ${MOCK_HOTELS.map((h) => h.hotelName).join(', ')}`);
    }
  } catch (error) {
    console.log(`❌ Rakuten API error: ${error.message}`);
    allGood = false;
  }

  console.log('\n' + '='.repeat(60));

  if (allGood) {
    console.log('✅ Environment check passed (with warnings)');
  } else {
    console.log('⚠️  Some required credentials are missing');
  }

  console.log('='.repeat(60) + '\n');
};

const main = async () => {
  // Supabase を初期化
  initSupabase();

  const args = process.argv.slice(2);

  if (args.includes('--check')) {
    await checkConnectivity();
    process.exit(0);
  }

  if (args.includes('--now')) {
    const result = await runDailyPost({ now: true });
    process.exit(result.success ? 0 : 1);
  }

  if (args.includes('--dry-run')) {
    const result = await runDailyPost({ dryRun: true });
    process.exit(result.success ? 0 : 1);
  }

  if (args.includes('--metrics')) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Fetching Threads Metrics');
    console.log('='.repeat(60) + '\n');

    const result = await fetchAndSaveAllPostMetrics();

    console.log('\n' + '='.repeat(60));
    if (result.success) {
      console.log(`✅ Metrics fetched successfully`);
      console.log(`   Total posts: ${result.totalPosts}`);
      console.log(`   Saved: ${result.savedCount}`);
      if (result.failedCount > 0) {
        console.log(`   Failed: ${result.failedCount}`);
      }
    } else {
      console.log(`❌ Failed to fetch metrics: ${result.error}`);
    }
    console.log('='.repeat(60) + '\n');

    process.exit(result.success ? 0 : 1);
  }

  const env = getEnvironmentVariables();
  logger.info('Starting Rakuten Travel Threads bot');

  console.log('\n' + '='.repeat(60));
  console.log('🚀 Rakuten Travel → Threads Auto-posting Bot');
  console.log('='.repeat(60));
  console.log(`Timezone: ${env.TIMEZONE}`);
  console.log(`Post time: ${env.POST_HOUR}:00 (every day)`);
  console.log(`Keywords: ${getSearchKeywords().join(', ')}`);
  console.log(`\nPress Ctrl+C to stop`);
  console.log('='.repeat(60) + '\n');

  scheduler.startScheduler(runDailyPost, env.TIMEZONE, env.POST_HOUR);

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    scheduler.stopScheduler();
    await closeBrowser();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    scheduler.stopScheduler();
    await closeBrowser();
    process.exit(0);
  });
};

main().catch((error) => {
  logger.error('Fatal error', { error: error.message });
  console.error('Fatal error:', error.message);
  process.exit(1);
});
