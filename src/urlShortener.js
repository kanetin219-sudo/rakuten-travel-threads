const logger = require('./logger');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../.url-cache.json');

const loadCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.warn('Failed to load URL cache', { error: error.message });
  }
  return {};
};

const saveCache = (cache) => {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    logger.warn('Failed to save URL cache', { error: error.message });
  }
};

const shortenUrl = async (longUrl) => {
  const cache = loadCache();

  if (cache[longUrl]) {
    logger.info(`Using cached URL for ${longUrl}`);
    return cache[longUrl];
  }

  try {
    const redirectBase = process.env.URL_REDIRECT_BASE;

    // URL_REDIRECT_BASE が設定されている場合、リダイレクトURL を組み立てる
    if (redirectBase) {
      // hotelNo を URL から抽出（クエリ文字列内の f_no パラメータから）
      // URL をデコードしてから正規表現でマッチさせる
      const decoded = decodeURIComponent(longUrl);
      const hotelNoMatch = decoded.match(/[?&]f_no=(\d+)/);
      if (hotelNoMatch && hotelNoMatch[1]) {
        const hotelNo = hotelNoMatch[1];
        const redirectUrl = `${redirectBase}/${hotelNo}`;
        logger.info(`Generated redirect URL: ${redirectUrl}`);
        cache[longUrl] = redirectUrl;
        saveCache(cache);
        return redirectUrl;
      }
    }

    // URL_REDIRECT_BASE が未設定 or hotelNo が抽出できない場合は長URL をそのまま返す
    logger.info('Using long URL (URL_REDIRECT_BASE not configured or hotelNo not found)');
    return longUrl;
  } catch (error) {
    logger.error('URL processing error', { error: error.message });
    return longUrl;
  }
};

const closeBrowser = async () => {
  // No browser cleanup needed
};

module.exports = {
  shortenUrl,
  closeBrowser,
};
