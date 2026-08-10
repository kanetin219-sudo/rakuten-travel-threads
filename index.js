require('dotenv').config();
const logger = require('./src/logger');
const rakuten = require('./src/rakuten');
const threads = require('./src/threads');
const postGenerator = require('./src/postGenerator');
const storage = require('./src/storage');
const scheduler = require('./src/scheduler');
const { closeBrowser } = require('./src/urlShortener');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const dayOfYear = require('dayjs/plugin/dayOfYear');

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
  };

  return vars;
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

    if (dryRun) {
      logger.info('DRY RUN: Post would be published', {
        hotelName: selectedHotel.hotelName,
        area: selectedHotel.area,
        affiliateUrl: selectedHotel.affiliateUrl,
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
      console.log('='.repeat(60) + '\n');

      return { success: true, dryRun: true, hotelName: selectedHotel.hotelName };
    }

    if (!env.THREADS_USER_ID || !env.THREADS_ACCESS_TOKEN) {
      logger.error('Threads credentials not configured');
      console.log('\n' + '='.repeat(60));
      console.log('⚠️  Threads credentials not configured');
      console.log('Set THREADS_USER_ID and THREADS_ACCESS_TOKEN in .env');
      console.log('='.repeat(60) + '\n');
      return { success: false, error: 'Threads credentials not configured' };
    }

    const postId = await threads.postToThreads(
      [postText1, postText2],
      env.THREADS_USER_ID,
      env.THREADS_ACCESS_TOKEN
    );

    storage.savePostedHotel(selectedHotel.hotelNo, selectedHotel.hotelName);

    logger.success(`Post published successfully`, {
      postId,
      hotelName: selectedHotel.hotelName,
      hotelNo: selectedHotel.hotelNo,
      area: selectedHotel.area,
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Post published successfully!');
    console.log('='.repeat(60));
    console.log(`Post ID: ${postId}`);
    console.log(`Hotel: ${selectedHotel.hotelName}`);
    console.log(`Area: ${selectedHotel.area}`);
    console.log('='.repeat(60) + '\n');

    return {
      success: true,
      postId,
      hotelName: selectedHotel.hotelName,
      hotelNo: selectedHotel.hotelNo,
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
