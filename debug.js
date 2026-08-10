require('dotenv').config();
const axios = require('axios');

const RAKUTEN_API_ENDPOINT = 'https://app.rakuten.co.jp/services/api/Travel/VacantHotelSearch/20170426';

const params = {
  applicationId: process.env.RAKUTEN_APPLICATION_ID,
  affiliateId: process.env.RAKUTEN_AFFILIATE_ID,
  keyword: '由布院',
  hits: 30,
  sort: 'review',
  responseType: 'json'
};

console.log('【Rakuten API デバッグ】\n');
console.log('Endpoint:', RAKUTEN_API_ENDPOINT);
console.log('Parameters:', JSON.stringify(params, null, 2));
console.log('\n【API リクエスト実行】\n');

axios.get(RAKUTEN_API_ENDPOINT, { params, timeout: 10000 })
  .then(response => {
    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Hotels found:', response.data.hotels?.length || 0);
    if (response.data.hotels && response.data.hotels.length > 0) {
      console.log('First hotel:', JSON.stringify(response.data.hotels[0], null, 2).substring(0, 200));
    }
  })
  .catch(error => {
    console.log('❌ Error!');
    console.log('Status:', error.response?.status);
    console.log('Status Text:', error.response?.statusText);
    console.log('Headers:', error.response?.headers);
    console.log('Data:', error.response?.data);
    console.log('Message:', error.message);
  });
