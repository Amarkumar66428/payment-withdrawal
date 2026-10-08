// run worker separately with `npm run worker`
const { connectDB, disconnectDB } = require("../../config/database");
const logger = require("../utils/logger");
const { startWorker } = require("./withdrawal.worker");

(async () => {
  try {
    await connectDB();
    const worker = startWorker();

    const shutdown = async (signal) => {
      logger.info("worker.shutdown", { signal });
      await worker.stop();
      await disconnectDB();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("worker.start_failed", { error: error.message });
    process.exit(1);
  }
})();
