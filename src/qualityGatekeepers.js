const logger = require('./logger');

class OfficialGatekeeper {
  name = '公式（ブランド規則）';

  validate(part1, part2) {
    const checks = {};
    const issues = [];

    // Part1チェック
    if (!part1 || part1.length === 0) {
      checks.part1Empty = false;
      issues.push(`${this.name}: Part1が空です`);
    } else {
      checks.part1Empty = true;
    }

    if (part1 && part1.length > 500) {
      checks.part1Length = false;
      issues.push(`${this.name}: Part1が500文字を超えています（${part1.length}文字）`);
    } else {
      checks.part1Length = true;
    }

    // Part2チェック
    if (!part2 || part2.length === 0) {
      checks.part2Empty = false;
      issues.push(`${this.name}: Part2が空です`);
    } else {
      checks.part2Empty = true;
    }

    if (part2 && part2.length > 500) {
      checks.part2Length = false;
      issues.push(`${this.name}: Part2が500文字を超えています（${part2.length}文字）`);
    } else {
      checks.part2Length = true;
    }

    // URL確認
    if (!part2?.includes('http')) {
      checks.hasUrl = false;
      issues.push(`${this.name}: URLが含まれていません`);
    } else {
      checks.hasUrl = true;
    }

    // Part1にホテル名がないか確認（ブランド保護）
    checks.noBlatantAd = !part1?.includes('ホテル') || part1?.length < 15;

    // 最低限の品質要件
    checks.minimalQuality = part1?.length > 15 && part2?.length > 50;
    if (!checks.minimalQuality) {
      issues.push(`${this.name}: 最低限の品質を満たしていません`);
    }

    const passed = Object.values(checks).every(v => v);

    return {
      gatekeeper: this.name,
      passed,
      score: Math.round((Object.values(checks).filter(v => v).length / Object.keys(checks).length) * 100),
      checks,
      issues,
    };
  }
}

class UserGatekeeper {
  name = 'ユーザー（クリック欲求）';

  validate(part1, part2) {
    const checks = {};
    const issues = [];

    // クリック欲求を高める要素
    const hookWords = ['マジ', 'ヤバい', 'やばい', 'この', '本気', 'ウソ', '信じられない', '必須', 'チェック'];
    const hasHookWords = hookWords.some(word => part1?.includes(word));
    checks.hasHook = hasHookWords;
    if (!hasHookWords) {
      issues.push(`${this.name}: クリック欲求を高めるフック言葉がありません`);
    }

    // 絵文字があるか
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    const hasEmoji = emojiRegex.test(part1 + part2);
    checks.hasEmoji = hasEmoji;
    if (!hasEmoji) {
      issues.push(`${this.name}: 絵文字がないと目立ちません`);
    }

    // CTA（行動喚起）があるか（Part1またはPart2のいずれかに）
    const ctaWords = ['リンク', 'チェック', '見て', '踏んで', '必須', '確認', '→', '👉', '👇', '🔗', '↓'];
    const hasCTA = ctaWords.some(word => (part1 + part2)?.includes(word));
    checks.hasCTA = hasCTA;
    if (!hasCTA) {
      issues.push(`${this.name}: クリックを促す行動喚起がありません`);
    }

    // 短すぎないか（続きが気になる長さ）
    const part1Length = part1?.length || 0;
    checks.part1NotTooShort = part1Length > 20;
    if (!checks.part1NotTooShort) {
      issues.push(`${this.name}: Part1が短すぎます（${part1Length}文字）`);
    }

    // Part2に説明があるか
    checks.part2HasDetail = part2?.length > 50;
    if (!checks.part2HasDetail) {
      issues.push(`${this.name}: Part2の説明が不足しています`);
    }

    const passed = Object.values(checks).every(v => v);

    return {
      gatekeeper: this.name,
      passed,
      score: Math.round((Object.values(checks).filter(v => v).length / Object.keys(checks).length) * 100),
      checks,
      issues,
    };
  }
}

class ExpertGatekeeper {
  name = '専門家（旅行業界知見）';

  validate(part1, part2, hotel = {}) {
    const checks = {};
    const issues = [];

    // 価格情報があるか
    const priceRegex = /[0-9,]+円/;
    checks.hasPrice = priceRegex.test(part1 + part2);
    if (!checks.hasPrice) {
      issues.push(`${this.name}: 価格情報がありません（ユーザーの判断材料に必須）`);
    }

    // 立地・地域情報があるか
    checks.hasLocation = /📍|県|市|エリア|地域/.test(part2);
    if (!checks.hasLocation) {
      issues.push(`${this.name}: 立地情報がありません`);
    }

    // ホテル名が明確か
    const hotelName = hotel?.hotelName || '';
    checks.hasHotelName = part2?.includes(hotelName) || hotelName.length === 0;
    if (!checks.hasHotelName && hotelName) {
      issues.push(`${this.name}: ホテル名が正確ではありません`);
    }

    // 特徴・USPが伝わるか
    checks.hasFeature = (part2?.length || 0) > 50;
    if (!checks.hasFeature) {
      issues.push(`${this.name}: ホテルの特徴・魅力が伝わっていません`);
    }

    // 自然な日本語か
    const unnaturalPattern = /！{3,}|？{3,}|。。。|…{3,}/;
    checks.naturalJapanese = !unnaturalPattern.test(part1 + part2);
    if (!checks.naturalJapanese) {
      issues.push(`${this.name}: 不自然な表現があります（記号の過度な使用など）`);
    }

    const passed = Object.values(checks).every(v => v);

    return {
      gatekeeper: this.name,
      passed,
      score: Math.round((Object.values(checks).filter(v => v).length / Object.keys(checks).length) * 100),
      checks,
      issues,
    };
  }
}

class DevilsAdvocateGatekeeper {
  name = 'わざと欠点探し（批判的審査）';

  validate(part1, part2, hotel = {}) {
    const checks = {};
    const issues = [];

    // クリックベイトになってないか（タイトルと内容が一致）
    const part1Keywords = part1?.match(/[ぁ-ん一-龥ァ-ヴー]/g) || [];
    const part2Keywords = part2?.match(/[ぁ-ん一-龥ァ-ヴー]/g) || [];
    const keywordMatch = part1Keywords.length > 0 && part2Keywords.length > 0;
    checks.noClickbait = keywordMatch;
    if (!checks.noClickbait) {
      issues.push(`${this.name}: Part1とPart2の内容が乖離しているかもしれません`);
    }

    // 誇大表現になってないか
    const exaggerated = /絶対|必ず|100%|最高|最強|唯一|ヤバい|ヤバ|やばい|やば/;
    checks.noExaggeration = !exaggerated.test(part1) || exaggerated.test(part1) && part2?.includes(hotel?.hotelName || '');
    if (!checks.noExaggeration) {
      issues.push(`${this.name}: 誇大表現の可能性があります`);
    }

    // スパム的な繰り返しがないか
    const hasRepetition = /(.)\1{4,}|(.{2,})\2{2,}/.test(part1 + part2);
    checks.noSpam = !hasRepetition;
    if (!checks.noSpam) {
      issues.push(`${this.name}: 不自然な繰り返しがあります`);
    }

    // ブランドやホテルの評判を傷つけてないか
    const negativeWords = /最悪|ダメ|つまらない|退屈|がっかり|ひどい|糞/i;
    checks.notNegative = !negativeWords.test(part1 + part2);
    if (!checks.notNegative) {
      issues.push(`${this.name}: ネガティブな表現が含まれています`);
    }

    // 個人情報や不適切な内容がないか
    const inappropriate = /電話|メール|LINE|住所|個人情報/i;
    checks.noInappropriate = !inappropriate.test(part1 + part2);
    if (!checks.noInappropriate) {
      issues.push(`${this.name}: 個人情報や不適切な内容が含まれています`);
    }

    // 競合他社を貶してないか
    checks.noCompetitorBashing = !/(より|比較|〜よりいい|〜なんて|〜は糞)/i.test(part1 + part2);
    if (!checks.noCompetitorBashing) {
      issues.push(`${this.name}: 競合他社を貶すような表現があります`);
    }

    const passed = Object.values(checks).every(v => v);

    return {
      gatekeeper: this.name,
      passed,
      score: Math.round((Object.values(checks).filter(v => v).length / Object.keys(checks).length) * 100),
      checks,
      issues,
    };
  }
}

class QualityGatekeepersSystem {
  gatekeepers = [
    new OfficialGatekeeper(),
    new UserGatekeeper(),
    new ExpertGatekeeper(),
    new DevilsAdvocateGatekeeper(),
  ];

  async validate(part1, part2, hotel = {}) {
    logger.info('Quality gatekeepers audit starting', { hotelName: hotel.hotelName });

    const results = this.gatekeepers.map(gatekeeper => gatekeeper.validate(part1, part2, hotel));

    const allPassed = results.every(r => r.passed);
    const averageScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);

    const report = {
      allPassed,
      averageScore,
      maxScore: 100,
      gatekeepers: results,
      summary: {
        passed: results.filter(r => r.passed).length,
        total: results.length,
        failedGatekeepers: results.filter(r => !r.passed).map(r => r.gatekeeper),
        allIssues: results.flatMap(r => r.issues),
      },
    };

    if (allPassed) {
      logger.success('Quality audit PASSED - All 4 gatekeepers approved', {
        hotelName: hotel.hotelName,
        score: averageScore,
      });
    } else {
      logger.warn('Quality audit FAILED - Some gatekeepers rejected', {
        hotelName: hotel.hotelName,
        failedGatekeepers: report.summary.failedGatekeepers,
        issues: report.summary.allIssues,
      });
    }

    return report;
  }
}

module.exports = {
  QualityGatekeepersSystem,
  OfficialGatekeeper,
  UserGatekeeper,
  ExpertGatekeeper,
  DevilsAdvocateGatekeeper,
};
