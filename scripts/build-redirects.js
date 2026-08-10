require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const RAKUTEN_API_ENDPOINT = 'https://openapi.rakuten.co.jp/engine/api/Travel/SimpleHotelSearch/20260731';
const REDIRECTS_FILE = path.join(__dirname, '../redirects.json');

const REGION_MAPPING = {
  '札幌': { latitude: 43.0642, longitude: 141.3469, searchRadius: 2.5 },
  '函館': { latitude: 41.7683, longitude: 140.7255, searchRadius: 2 },
  '小樽': { latitude: 43.1919, longitude: 140.9926, searchRadius: 2 },
  '釧路': { latitude: 42.9849, longitude: 144.3803, searchRadius: 2.5 },
  '青森': { latitude: 40.8244, longitude: 140.7469, searchRadius: 2.5 },
  '秋田': { latitude: 39.7861, longitude: 140.1277, searchRadius: 2.5 },
  '仙台': { latitude: 38.2688, longitude: 140.8694, searchRadius: 2.5 },
  '山形': { latitude: 38.2446, longitude: 140.3469, searchRadius: 2 },
  '福島': { latitude: 37.7597, longitude: 140.4735, searchRadius: 2.5 },
  '東京': { latitude: 35.6762, longitude: 139.6503, searchRadius: 3 },
  '横浜': { latitude: 35.4437, longitude: 139.6380, searchRadius: 2.5 },
  '日光': { latitude: 36.7335, longitude: 139.5003, searchRadius: 2.5 },
  '箱根': { latitude: 35.2337, longitude: 139.0337, searchRadius: 2 },
  '伊豆': { latitude: 34.8019, longitude: 139.1189, searchRadius: 2.5 },
  '名古屋': { latitude: 35.1815, longitude: 136.9066, searchRadius: 2.5 },
  '金沢': { latitude: 36.5944, longitude: 136.6563, searchRadius: 2.5 },
  '岐阜': { latitude: 35.3910, longitude: 136.7623, searchRadius: 2 },
  '松本': { latitude: 36.2386, longitude: 137.9713, searchRadius: 2.5 },
  '熱海': { latitude: 35.0976, longitude: 139.0763, searchRadius: 2 },
  '京都': { latitude: 35.0116, longitude: 135.7681, searchRadius: 2.5 },
  '大阪': { latitude: 34.6937, longitude: 135.5023, searchRadius: 2.5 },
  '神戸': { latitude: 34.6901, longitude: 135.1955, searchRadius: 2.5 },
  '奈良': { latitude: 34.6851, longitude: 135.8048, searchRadius: 2 },
  '和歌山': { latitude: 34.2265, longitude: 135.1671, searchRadius: 2.5 },
  '広島': { latitude: 34.3853, longitude: 132.4553, searchRadius: 2.5 },
  '岡山': { latitude: 34.6552, longitude: 133.9201, searchRadius: 2.5 },
  '倉敷': { latitude: 34.5903, longitude: 133.7766, searchRadius: 2 },
  '高知': { latitude: 33.5566, longitude: 133.5310, searchRadius: 2.5 },
  '香川': { latitude: 34.3401, longitude: 134.0434, searchRadius: 2.5 },
  '愛媛': { latitude: 33.8389, longitude: 132.7656, searchRadius: 2.5 },
  '福岡': { latitude: 33.5904, longitude: 130.4017, searchRadius: 2.5 },
  '佐賀': { latitude: 33.2492, longitude: 130.2995, searchRadius: 2.5 },
  '長崎': { latitude: 32.7503, longitude: 129.8676, searchRadius: 2.5 },
  '熊本': { latitude: 32.7898, longitude: 130.7418, searchRadius: 2.5 },
  '大分': { latitude: 33.2273, longitude: 131.6124, searchRadius: 2.5 },
  '由布院': { latitude: 33.1307, longitude: 131.3833, searchRadius: 2 },
  '別府': { latitude: 33.2836, longitude: 131.4917, searchRadius: 2 },
  '宮崎': { latitude: 31.9111, longitude: 131.4239, searchRadius: 2.5 },
  '鹿児島': { latitude: 31.5960, longitude: 130.5573, searchRadius: 2.5 },
  '子連れ旅行': { latitude: 35.5, longitude: 139.5, searchRadius: 3 },
  '温泉宿': { latitude: 34.5, longitude: 132.5, searchRadius: 3 },
  'グランピング': { latitude: 36.0, longitude: 138.0, searchRadius: 3 },
};

async function buildRedirects() {
  console.log('Building redirects...');

  const applicationId = process.env.RAKUTEN_APPLICATION_ID;
  const accessKey = process.env.RAKUTEN_ACCESS_KEY;
  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID;

  if (!applicationId || !accessKey || !affiliateId) {
    console.error('❌ Missing Rakuten credentials');
    process.exit(1);
  }

  // 既存のリダイレクト情報を読み込む
  let existingRedirects = {};
  if (fs.existsSync(REDIRECTS_FILE)) {
    try {
      const data = fs.readFileSync(REDIRECTS_FILE, 'utf-8');
      existingRedirects = JSON.parse(data);
      console.log(`✅ Loaded ${Object.keys(existingRedirects).length} existing redirects`);
    } catch (error) {
      console.warn('⚠️  Could not load existing redirects:', error.message);
    }
  }

  const redirects = { ...existingRedirects };
  let newCount = 0;

  // 各地域からホテルを取得
  for (const [region, coords] of Object.entries(REGION_MAPPING)) {
    try {
      console.log(`Fetching hotels for: ${region}`);

      const params = {
        applicationId,
        accessKey,
        affiliateId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        searchRadius: coords.searchRadius,
        datumType: 1,
        hits: 30,
        format: 'json',
      };

      const response = await axios.get(RAKUTEN_API_ENDPOINT, { params, timeout: 10000 });

      if (response.data.hotels && response.data.hotels.length > 0) {
        response.data.hotels.forEach((hotel) => {
          const basicInfo = hotel.hotel[0].hotelBasicInfo;
          const hotelNo = String(basicInfo.hotelNo);
          const longUrl = basicInfo.planListUrl || '';

          if (!redirects[hotelNo]) {
            redirects[hotelNo] = longUrl;
            newCount++;
          }
        });
        console.log(`  ✅ Added ${response.data.hotels.length} hotels from ${region}`);
      }

      // API呼び出し頻度を調整
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ Error fetching hotels for ${region}:`, error.message);
    }
  }

  // redirects.json に書き出す
  fs.writeFileSync(REDIRECTS_FILE, JSON.stringify(redirects, null, 2));
  console.log(`\n✅ redirects.json updated`);
  console.log(`   Total entries: ${Object.keys(redirects).length}`);
  console.log(`   New entries: ${newCount}`);

  // サンプルを表示
  const entries = Object.entries(redirects).slice(0, 2);
  console.log('\nSample entries:');
  entries.forEach(([id, url]) => {
    console.log(`  ${id}: ${url.substring(0, 80)}...`);
  });
}

buildRedirects().catch((error) => {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
});
