const axios = require('axios');
const logger = require('./logger');
const { shortenUrl } = require('./urlShortener');

const RAKUTEN_API_ENDPOINT = 'https://openapi.rakuten.co.jp/engine/api/Travel/SimpleHotelSearch/20260731';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000];

const REGION_MAPPING = {
  // 北海道
  '札幌': { latitude: 43.0642, longitude: 141.3469, searchRadius: 2.5 },
  '函館': { latitude: 41.7683, longitude: 140.7255, searchRadius: 2 },
  '小樽': { latitude: 43.1919, longitude: 140.9926, searchRadius: 2 },
  '釧路': { latitude: 42.9849, longitude: 144.3803, searchRadius: 2.5 },
  // 東北
  '青森': { latitude: 40.8244, longitude: 140.7469, searchRadius: 2.5 },
  '秋田': { latitude: 39.7861, longitude: 140.1277, searchRadius: 2.5 },
  '仙台': { latitude: 38.2688, longitude: 140.8694, searchRadius: 2.5 },
  '山形': { latitude: 38.2446, longitude: 140.3469, searchRadius: 2 },
  '福島': { latitude: 37.7597, longitude: 140.4735, searchRadius: 2.5 },
  // 関東
  '東京': { latitude: 35.6762, longitude: 139.6503, searchRadius: 3 },
  '横浜': { latitude: 35.4437, longitude: 139.6380, searchRadius: 2.5 },
  '日光': { latitude: 36.7335, longitude: 139.5003, searchRadius: 2.5 },
  '箱根': { latitude: 35.2337, longitude: 139.0337, searchRadius: 2 },
  '伊豆': { latitude: 34.8019, longitude: 139.1189, searchRadius: 2.5 },
  // 中部
  '名古屋': { latitude: 35.1815, longitude: 136.9066, searchRadius: 2.5 },
  '金沢': { latitude: 36.5944, longitude: 136.6563, searchRadius: 2.5 },
  '岐阜': { latitude: 35.3910, longitude: 136.7623, searchRadius: 2 },
  '松本': { latitude: 36.2386, longitude: 137.9713, searchRadius: 2.5 },
  '熱海': { latitude: 35.0976, longitude: 139.0763, searchRadius: 2 },
  // 関西
  '京都': { latitude: 35.0116, longitude: 135.7681, searchRadius: 2.5 },
  '大阪': { latitude: 34.6937, longitude: 135.5023, searchRadius: 2.5 },
  '神戸': { latitude: 34.6901, longitude: 135.1955, searchRadius: 2.5 },
  '奈良': { latitude: 34.6851, longitude: 135.8048, searchRadius: 2 },
  '和歌山': { latitude: 34.2265, longitude: 135.1671, searchRadius: 2.5 },
  // 中国
  '広島': { latitude: 34.3853, longitude: 132.4553, searchRadius: 2.5 },
  '岡山': { latitude: 34.6552, longitude: 133.9201, searchRadius: 2.5 },
  '倉敷': { latitude: 34.5903, longitude: 133.7766, searchRadius: 2 },
  // 四国
  '高知': { latitude: 33.5566, longitude: 133.5310, searchRadius: 2.5 },
  '香川': { latitude: 34.3401, longitude: 134.0434, searchRadius: 2.5 },
  '愛媛': { latitude: 33.8389, longitude: 132.7656, searchRadius: 2.5 },
  // 九州
  '福岡': { latitude: 33.5904, longitude: 130.4017, searchRadius: 2.5 },
  '佐賀': { latitude: 33.2492, longitude: 130.2995, searchRadius: 2.5 },
  '長崎': { latitude: 32.7503, longitude: 129.8676, searchRadius: 2.5 },
  '熊本': { latitude: 32.7898, longitude: 130.7418, searchRadius: 2.5 },
  '大分': { latitude: 33.2273, longitude: 131.6124, searchRadius: 2.5 },
  '由布院': { latitude: 33.1307, longitude: 131.3833, searchRadius: 2 },
  '別府': { latitude: 33.2836, longitude: 131.4917, searchRadius: 2 },
  '宮崎': { latitude: 31.9111, longitude: 131.4239, searchRadius: 2.5 },
  '鹿児島': { latitude: 31.5960, longitude: 130.5573, searchRadius: 2.5 },
  // テーマ検索
  '子連れ旅行': { latitude: 35.5, longitude: 139.5, searchRadius: 3 },
  '温泉宿': { latitude: 34.5, longitude: 132.5, searchRadius: 3 },
  'グランピング': { latitude: 36.0, longitude: 138.0, searchRadius: 3 },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (retryCount) => RETRY_DELAYS[retryCount] || 10000;

const searchHotels = async (keyword, options = {}) => {
  const {
    applicationId,
    accessKey,
    affiliateId,
    hits = 30,
  } = options;

  if (!applicationId || !accessKey || !affiliateId) {
    logger.error('Missing Rakuten API credentials');
    throw new Error('RAKUTEN_APPLICATION_ID, RAKUTEN_ACCESS_KEY, or RAKUTEN_AFFILIATE_ID not set');
  }

  const regionCoords = REGION_MAPPING[keyword];
  if (!regionCoords) {
    logger.warn(`Unknown region keyword: ${keyword}`);
    return [];
  }

  const params = {
    applicationId,
    accessKey,
    affiliateId,
    latitude: regionCoords.latitude,
    longitude: regionCoords.longitude,
    searchRadius: regionCoords.searchRadius,
    datumType: 1,
    hits,
    format: 'json'
  };

  let lastError;

  for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    try {
      logger.info(`Searching Rakuten Travel: ${keyword} (Coordinates: ${regionCoords.latitude}, ${regionCoords.longitude}) (Retry: ${retryCount}/${MAX_RETRIES})`);
      logger.debug(`API Parameters:`, params);

      const response = await axios.get(RAKUTEN_API_ENDPOINT, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      logger.debug(`Rakuten API response received for ${keyword}`, { dataKeys: Object.keys(response.data) });

      if (!response.data.hotels || response.data.hotels.length === 0) {
        logger.warn(`No hotels found for keyword: ${keyword}`);
        return [];
      }

      logger.info(`Found ${response.data.hotels.length} hotels for: ${keyword}`);

      return Promise.all(response.data.hotels.map(async (hotel) => {
        const basicInfo = hotel.hotel[0].hotelBasicInfo;
        const longUrl = basicInfo.planListUrl || '';

        let shortenedUrl = longUrl;
        if (longUrl) {
          try {
            shortenedUrl = await shortenUrl(longUrl);
          } catch (error) {
            logger.warn(`Failed to shorten URL for ${basicInfo.hotelName}, using long URL`, { error: error.message });
            shortenedUrl = longUrl;
          }
        }

        const minPrice = parseInt(basicInfo.hotelMinCharge) || 0;
        const maxPrice = parseInt(basicInfo.hotelMaxCharge) || minPrice || 0;

        return {
          hotelNo: basicInfo.hotelNo,
          hotelName: basicInfo.hotelName,
          hotelAddress: basicInfo.address2,
          area: basicInfo.address1,
          catchCopy: basicInfo.hotelSpecial || '',
          featureKeywords: basicInfo.hotelSpecial || '',
          reviewAverage: parseFloat(basicInfo.reviewAverage) || 0,
          reviewCount: parseInt(basicInfo.reviewCount) || 0,
          images: [
            basicInfo.hotelImageUrl,
            basicInfo.roomImageUrl,
            basicInfo.hotelMapImageUrl,
          ].filter(Boolean),
          minPrice,
          maxPrice: Math.max(maxPrice, minPrice * 1.5),
          reservationUrl: longUrl,
          affiliateUrl: shortenedUrl,
        };
      }));
    } catch (error) {
      lastError = error;

      const statusCode = error.response?.status;
      const errorData = error.response?.data;
      const errorMessage = error.response?.statusText;

      if (statusCode === 401 || statusCode === 403) {
        logger.error('Rakuten API authentication error', {
          statusCode,
          statusText: errorMessage,
          message: error.message,
          responseData: errorData
        });
        throw error;
      }

      if (statusCode === 429) {
        logger.warn(`Rate limited by Rakuten API. Retrying after delay...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          logger.info(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
      }

      if (statusCode >= 500) {
        logger.warn(`Rakuten API server error (${statusCode}). Retrying...`, { errorData });
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

      logger.error('Rakuten API error', {
        statusCode,
        message: error.message,
        retry: retryCount
      });
    }
  }

  logger.error(`Failed to search hotels after ${MAX_RETRIES} retries`, {
    keyword,
    lastError: lastError?.message
  });

  throw lastError;
};

const calculateHotelScore = (hotel, alreadyPosted = false) => {
  if (alreadyPosted) return -1000;

  let score = 0;

  // 割引率で評価（絶対額ではなく割引率）
  const maxPrice = hotel.maxPrice || hotel.minPrice || 1;
  const discountRate = ((maxPrice - (hotel.minPrice || 0)) / maxPrice) * 100;
  score += discountRate;

  // ファミリー向けキーワードをチェック
  const familyKeywords = ['子連れ', 'ファミリー', 'キッズ', '家族', '子ども', 'お子様', 'プール', '温泉', '大浴場', '家族風呂'];
  const catchCopyLower = (hotel.catchCopy || '').toLowerCase();
  const featureKeywordsLower = (hotel.featureKeywords || '').toLowerCase();

  let familyKeywordMatches = 0;
  for (const keyword of familyKeywords) {
    if (catchCopyLower.includes(keyword) || featureKeywordsLower.includes(keyword)) {
      familyKeywordMatches++;
    }
  }
  score += familyKeywordMatches * 25;

  // レビュー評価
  score += hotel.reviewAverage * 15;
  score += Math.log10(hotel.reviewCount + 1) * 8;

  // アフィリエイトURL
  score += hotel.affiliateUrl ? 20 : 0;

  // 最低価格ボーナス（ファミリー向け）
  if (hotel.minPrice && hotel.minPrice < 15000) {
    score += 30;
  }

  // 画像
  score += hotel.images && hotel.images.length > 0 ? 10 : 0;

  return score;
};

module.exports = {
  searchHotels,
  calculateHotelScore,
};
