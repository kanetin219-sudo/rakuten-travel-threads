const logger = require('./logger');

const EXCLAMATIONS = [
  'ママ必見だよ',
  'これマジ？',
  'え、この値段？',
  'ヤバすぎる',
  'まさかこんな…',
];

const CATCHPHRASES = [
  'しかも子どもたちが喜ぶ設備がいっぱい？？？',
  'しかも大浴場で家族でリラックス？？？',
  'しかもキッズに優しい環境だって？？？',
  'しかも食べ盛り息子たちのお財布が救われる？？？',
  'しかも温泉でママのストレスも軽減？？？',
];

const CLOSINGLINES = [
  'ママのお小遣いからでも行けちゃう😭',
  'これでファミリー旅行が叶う♡',
  'GW や夏休み前にチェック必須！',
  'お子さんたちのはしゃぐ顔が見える…',
  'リピート確定の価格帯です！',
];

const getRandomElement = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

const generateThreadsPostPart1 = (hotel) => {
  if (!hotel) {
    logger.error('Hotel data missing', { hotel });
    throw new Error('Invalid hotel data');
  }

  const exclamation = getRandomElement(EXCLAMATIONS);
  const catchphrase = getRandomElement(CATCHPHRASES);

  let post = `${exclamation}！！！！！\n\n`;
  post += `${hotel.area}にある ${hotel.hotelName} が\n`;
  post += `この値段？？？\n\n`;
  post += `${catchphrase}\n\n`;
  post += `もっとやばいのが…`;

  logger.info(`Generated thread part 1 (${post.length}/500 chars)`, { hotelName: hotel.hotelName });

  return post;
};

const generateThreadsPostPart2 = (hotel) => {
  if (!hotel || !hotel.affiliateUrl) {
    logger.error('Hotel data missing or no affiliate URL', { hotel });
    throw new Error('Invalid hotel data or missing affiliate URL');
  }

  const priceRange = hotel.minPrice && hotel.maxPrice
    ? `${hotel.minPrice.toLocaleString('ja-JP')}円〜${hotel.maxPrice.toLocaleString('ja-JP')}円`
    : hotel.minPrice
      ? `${hotel.minPrice.toLocaleString('ja-JP')}円〜`
      : '要確認';

  const closingline = getRandomElement(CLOSINGLINES);

  let post = '';
  post += `${hotel.hotelName}\n\n`;
  post += `📍 ${hotel.area}\n`;
  post += `🏘️ ${hotel.catchCopy.substring(0, 30)}...\n\n`;
  post += `料金帯：1人あたり ${priceRange}\n\n`;
  post += `${hotel.catchCopy}\n\n`;
  post += `${closingline}\n\n`;
  post += `#PR\n\n`;
  post += `${hotel.affiliateUrl}`;

  logger.info(`Generated thread part 2 (${post.length}/500 chars)`, { hotelName: hotel.hotelName });

  return post;
};

module.exports = {
  generateThreadsPostPart1,
  generateThreadsPostPart2,
};
