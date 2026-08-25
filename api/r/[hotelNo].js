import fs from 'fs';
import path from 'path';

// アフィリエイトID（Vercel環境変数で上書き可・未設定時は既定値）
const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID || '56509bd0.96fbfa96.56509bd1.966450a0';

// リダイレクト表に無いホテルでも、hotelNoからアフィリエイトURLをその場で組み立てる
// （f_no == hotelNo。楽天トラベルのホテルページを対象にアフィリエイトラッパーで包む）
function buildAffiliateUrl(hotelNo) {
  const hotelPage = `https://travel.rakuten.co.jp/HOTEL/${hotelNo}/${hotelNo}.html`;
  const enc = encodeURIComponent(hotelPage);
  return `https://hb.afl.rakuten.co.jp/hgc/${AFFILIATE_ID}/?pc=${enc}&m=${enc}`;
}

let redirectsCache = null;

function loadRedirects() {
  if (redirectsCache) {
    return redirectsCache;
  }

  const redirectsPath = path.join(process.cwd(), 'redirects.json');
  if (!fs.existsSync(redirectsPath)) {
    return {};
  }

  try {
    const data = fs.readFileSync(redirectsPath, 'utf-8');
    redirectsCache = JSON.parse(data);
    return redirectsCache;
  } catch (error) {
    console.error('Failed to load redirects.json:', error.message);
    return {};
  }
}

export default function handler(req, res) {
  const { hotelNo, ...otherParams } = req.query;

  // バリデーション: hotelNo は数字のみ
  if (!hotelNo || !/^\d+$/.test(hotelNo)) {
    return res.status(400).json({
      error: 'Invalid hotelNo. Must be a number.',
    });
  }

  // 対応表を読み込む（あれば使い、無ければ hotelNo から組み立てる）
  const redirects = loadRedirects();
  const targetUrl = redirects[hotelNo] || buildAffiliateUrl(hotelNo);

  // 他のクエリパラメータ（pr など）をリダイレクト先URLに追加
  let finalUrl = targetUrl;
  const hasQuery = targetUrl.includes('?');
  Object.entries(otherParams).forEach(([key, value]) => {
    const separator = finalUrl.includes('?') ? '&' : '?';
    if (value === '' || value === true) {
      finalUrl += `${separator}${key}`;
    } else {
      finalUrl += `${separator}${key}=${value}`;
    }
  });

  // キャッシュを設定
  res.setHeader('Cache-Control', 'public, max-age=3600');

  // 301 リダイレクト
  res.redirect(301, finalUrl);
}
