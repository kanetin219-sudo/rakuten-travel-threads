const logger = require('./logger');

const QUALITY_CHECKS = {
  CHAR_COUNT: { score: 20, threshold: 1 },
  HAS_EMOJI: { score: 15, threshold: 1 },
  HAS_HOOK: { score: 20, threshold: 1 },
  NATURAL_LANGUAGE: { score: 20, threshold: 1 },
  HAS_PRICE: { score: 15, threshold: 1 },
  HAS_LOCATION: { score: 10, threshold: 1 },
};

const REQUIRED_SCORE = 80;

// フック度を判定するキーワード
const HOOK_KEYWORDS = [
  'マジ', 'ヤバい', 'やばい', 'これ', 'この', '本気',
  'すごい', 'とんでもない', '信じられない', 'ウソでしょ',
  '絶対', '必須', '見た方がいい', 'チェック', 'リンク'
];

const checkCharCount = (text) => {
  if (!text) return false;
  return text.length > 20 && text.length <= 500;
};

const checkHasEmoji = (text) => {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  return emojiRegex.test(text);
};

const checkHasHook = (text) => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return HOOK_KEYWORDS.some(keyword => lowerText.includes(keyword));
};

const checkNaturalLanguage = (text) => {
  if (!text) return false;

  // 極端な記号の重複チェック
  if (/！{3,}|？{3,}/.test(text)) return false;

  // ひらがな、カタカナ、漢字のいずれかが含まれているか
  return /[぀-ゟ゠-ヿ一-鿿]/.test(text);
};

const checkHasPrice = (text) => {
  return /[0-9,]+円/.test(text);
};

const checkHasLocation = (text) => {
  return /📍|県|市|地|エリア/.test(text);
};

const scorePost = (postText, type = 'general') => {
  const scores = {};
  let totalScore = 0;

  // Part1（フック）の場合
  if (type === 'hook') {
    scores.charCount = checkCharCount(postText) ? QUALITY_CHECKS.CHAR_COUNT.score : 0;
    scores.hasEmoji = checkHasEmoji(postText) ? QUALITY_CHECKS.HAS_EMOJI.score : 0;
    scores.hasHook = checkHasHook(postText) ? QUALITY_CHECKS.HAS_HOOK.score : 0;
    scores.naturalLanguage = checkNaturalLanguage(postText) ? QUALITY_CHECKS.NATURAL_LANGUAGE.score : 0;
    scores.hasPrice = checkHasPrice(postText) ? QUALITY_CHECKS.HAS_PRICE.score : 0;

    totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  }
  // Part2（詳細）の場合
  else if (type === 'detail') {
    scores.charCount = checkCharCount(postText) ? QUALITY_CHECKS.CHAR_COUNT.score : 0;
    scores.hasEmoji = checkHasEmoji(postText) ? QUALITY_CHECKS.HAS_EMOJI.score : 0;
    scores.naturalLanguage = checkNaturalLanguage(postText) ? QUALITY_CHECKS.NATURAL_LANGUAGE.score : 0;
    scores.hasLocation = checkHasLocation(postText) ? QUALITY_CHECKS.HAS_LOCATION.score : 0;
    scores.hasHook = checkHasHook(postText) ? QUALITY_CHECKS.HAS_HOOK.score : 0;

    totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  }

  return {
    totalScore,
    maxScore: 100,
    passed: totalScore >= REQUIRED_SCORE,
    scores,
    breakdown: {
      charCount: {
        passed: scores.charCount > 0,
        reason: `文字数: ${postText.length}文字 (20-500が要件)`
      },
      hasEmoji: {
        passed: scores.hasEmoji > 0,
        reason: 'クリックしたくなる絵文字は必須'
      },
      hasHook: {
        passed: scores.hasHook > 0,
        reason: 'クリック欲求を高めるフック度'
      },
      naturalLanguage: {
        passed: scores.naturalLanguage > 0,
        reason: '自然な日本語であること'
      },
      hasPrice: {
        passed: scores.hasPrice > 0,
        reason: 'type=hookの場合、価格表示必須'
      },
      hasLocation: {
        passed: scores.hasLocation > 0,
        reason: 'type=detailの場合、場所表示必須'
      }
    }
  };
};

const validateThreadsPosts = (part1, part2) => {
  const result1 = scorePost(part1, 'hook');
  const result2 = scorePost(part2, 'detail');

  const passed = result1.passed && result2.passed;

  logger.info(`Quality check: Part1=${result1.totalScore}/100, Part2=${result2.totalScore}/100, Overall=${passed ? 'PASS' : 'FAIL'}`);

  return {
    passed,
    part1: result1,
    part2: result2,
    summary: {
      qualityScore: Math.round((result1.totalScore + result2.totalScore) / 2),
      maxScore: 100,
      issues: [
        ...Object.entries(result1.breakdown)
          .filter(([_, check]) => !check.passed)
          .map(([key, check]) => `Part1: ${check.reason}`),
        ...Object.entries(result2.breakdown)
          .filter(([_, check]) => !check.passed)
          .map(([key, check]) => `Part2: ${check.reason}`),
      ]
    }
  };
};

module.exports = {
  validateThreadsPosts,
  scorePost,
  REQUIRED_SCORE,
};
