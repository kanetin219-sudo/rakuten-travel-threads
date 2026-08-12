const logger = require('./logger');

// Part1のフックテンプレート - クリック欲求を最大化
const PART1_TEMPLATES = [
  // 疑問形（続きが気になる）
  (h) => `マジ？${h.area}でこの値段\nしかも泉質が…🏨`,
  (h) => `えっ、このホテル\n1人${h.minPrice.toLocaleString('ja-JP')}円？マジで🔗`,
  (h) => `子どもたちが「また行きたい」\nその理由がヤバい🏨`,

  // 驚き（ギャップ）
  (h) => `${h.area}で1人${h.minPrice.toLocaleString('ja-JP')}円？\nこれマジなの…🏨`,
  (h) => `この写真見て\n「えっ、ここ？」ってなった🔗`,

  // 感情訴求（ママ心）
  (h) => `子どもたちの笑顔がずっと忘れられない\nそのやばい理由↓🏨`,
  (h) => `ママ友に聞かれまくってる\n${h.area}の神ホテルをチェック👉`,

  // 緊急感
  (h) => `マジで埋まる前に\n${h.area}のここをチェック必須👇`,
  (h) => `これかなりやばい\nママたちが選ぶホテルの真実🔗`,
];

// Part2の詳細テンプレート - 納得させる＋CTA（必ず価格を含める）
const PART2_TEMPLATES = [
  (h) => `${h.hotelName}\n📍 ${h.area}\n💰 1人${h.minPrice.toLocaleString('ja-JP')}円〜\n\n${h.catchCopy}\n\nチェック必須👇\n#PR\n${h.affiliateUrl}`,
  (h) => `${h.hotelName}\n📍 ${h.area}\n\n✓ 大浴場で家族リラックス\n✓ 1人${h.minPrice.toLocaleString('ja-JP')}円〜\n\n詳細を見て→\n#PR\n${h.affiliateUrl}`,
  (h) => `${h.hotelName}\n📍 ${h.area}\n\n料金：1人${h.minPrice.toLocaleString('ja-JP')}円〜\n理由は👇\n#PR\n${h.affiliateUrl}`,
  (h) => `${h.hotelName}\n📍 ${h.area}\n💰 1人${h.minPrice.toLocaleString('ja-JP')}円〜\n\nママ友の実評価\nチェック→\n#PR\n${h.affiliateUrl}`,
  (h) => `${h.hotelName}\n📍 ${h.area}\n\n1人${h.minPrice.toLocaleString('ja-JP')}円で\nこれ？ヤバい🔗\n#PR\n${h.affiliateUrl}`,
];

const getRandomElement = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

const generateThreadsPostPart1 = (hotel) => {
  if (!hotel) {
    logger.error('Hotel data missing', { hotel });
    throw new Error('Invalid hotel data');
  }

  const template = getRandomElement(PART1_TEMPLATES);
  const post = template(hotel);

  logger.info(`Generated thread part 1 (${post.length}/500 chars)`, { hotelName: hotel.hotelName });

  return post;
};

const generateThreadsPostPart2 = (hotel) => {
  if (!hotel || !hotel.affiliateUrl) {
    logger.error('Hotel data missing or no affiliate URL', { hotel });
    throw new Error('Invalid hotel data or missing affiliate URL');
  }

  const template = getRandomElement(PART2_TEMPLATES);
  const post = template(hotel);

  logger.info(`Generated thread part 2 (${post.length}/500 chars)`, { hotelName: hotel.hotelName });

  return post;
};

module.exports = {
  generateThreadsPostPart1,
  generateThreadsPostPart2,
};
