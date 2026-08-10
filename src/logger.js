const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const logsDir = path.join(__dirname, '..', 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'app.log');

const maskSensitive = (text) => {
  if (typeof text !== 'string') return text;
  return text
    .replace(/access_token['\"]?\s*[:=]\s*['\"]?[a-zA-Z0-9_-]{20,}['\"]?/gi, 'access_token=***')
    .replace(/THREADS_ACCESS_TOKEN['\"]?\s*[:=]\s*['\"]?[a-zA-Z0-9_-]{20,}['\"]?/gi, 'THREADS_ACCESS_TOKEN=***')
    .replace(/api_key['\"]?\s*[:=]\s*['\"]?[a-zA-Z0-9_-]{20,}['\"]?/gi, 'api_key=***')
    .replace(/authorization['\"]?\s*[:=]\s*Bearer\s+[a-zA-Z0-9_-]{20,}/gi, 'authorization=Bearer ***')
    .replace(/token['\"]?\s*[:=]\s*['\"]?[a-zA-Z0-9_-]{20,}['\"]?/gi, 'token=***');
};

const log = (level, message, meta = {}) => {
  const timestamp = dayjs().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss Z');

  const logEntry = {
    timestamp,
    level,
    message: maskSensitive(message),
    ...meta
  };

  const logText = `[${timestamp}] [${level}] ${maskSensitive(message)}`;

  if (Object.keys(meta).length > 0) {
    const metaStr = JSON.stringify(meta, null, 2);
    const maskedMeta = maskSensitive(metaStr);
    console.log(`${logText}\n${maskedMeta}`);
  } else {
    console.log(logText);
  }

  fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
};

module.exports = {
  info: (message, meta) => log('INFO', message, meta),
  error: (message, meta) => log('ERROR', message, meta),
  warn: (message, meta) => log('WARN', message, meta),
  debug: (message, meta) => log('DEBUG', message, meta),
  success: (message, meta) => log('SUCCESS', message, meta),
  getLogPath: () => logFilePath
};
