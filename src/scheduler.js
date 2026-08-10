const cron = require('node-cron');
const logger = require('./logger');

let scheduledTask = null;

const startScheduler = (runDailyPost, timezone = 'Asia/Tokyo', postHour = 19) => {
  const cronExpression = `0 ${postHour} * * *`;

  try {
    scheduledTask = cron.schedule(cronExpression, async () => {
      logger.info('Scheduled task triggered', { time: `${postHour}:00`, timezone });
      try {
        await runDailyPost();
      } catch (error) {
        logger.error('Scheduled task failed', { error: error.message });
      }
    }, {
      timezone
    });

    logger.info(`Scheduler started: ${cronExpression} (${timezone}) - ${postHour}:00 JST`);
    return scheduledTask;
  } catch (error) {
    logger.error('Failed to start scheduler', { error: error.message });
    throw error;
  }
};

const stopScheduler = () => {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask.destroy();
    scheduledTask = null;
    logger.info('Scheduler stopped');
  }
};

module.exports = {
  startScheduler,
  stopScheduler,
};
