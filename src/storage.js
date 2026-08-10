const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const logger = require('./logger');

const storageFile = path.join(__dirname, '..', 'posted-hotels.json');

const ensureStorageFile = () => {
  if (!fs.existsSync(storageFile)) {
    fs.writeFileSync(storageFile, JSON.stringify([], null, 2));
  }
};

const getPostedHotels = () => {
  ensureStorageFile();
  try {
    const data = fs.readFileSync(storageFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('Failed to read posted-hotels.json', { error: error.message });
    return [];
  }
};

const isHotelPosted = (hotelNo, days = 30) => {
  const posted = getPostedHotels();
  const cutoffDate = dayjs().subtract(days, 'day');

  return posted.some((hotel) => {
    return (
      hotel.hotelNo === hotelNo &&
      dayjs(hotel.postedAt).isAfter(cutoffDate)
    );
  });
};

const savePostedHotel = (hotelNo, hotelName) => {
  try {
    const posted = getPostedHotels();

    posted.push({
      hotelNo,
      hotelName,
      postedAt: dayjs().tz('Asia/Tokyo').format()
    });

    fs.writeFileSync(storageFile, JSON.stringify(posted, null, 2));
    logger.info(`Saved posted hotel: ${hotelName} (${hotelNo})`);
  } catch (error) {
    logger.error('Failed to save posted hotel', { error: error.message });
    throw error;
  }
};

const getRecentlyPostedKeywords = (days = 3) => {
  const posted = getPostedHotels();
  const cutoffDate = dayjs().subtract(days, 'day');

  return posted
    .filter((hotel) => dayjs(hotel.postedAt).isAfter(cutoffDate))
    .map((hotel) => hotel.hotelName);
};

module.exports = {
  ensureStorageFile,
  getPostedHotels,
  isHotelPosted,
  savePostedHotel,
  getRecentlyPostedKeywords,
  getStorageFilePath: () => storageFile
};
