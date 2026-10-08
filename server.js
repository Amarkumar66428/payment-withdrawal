const config = require("./config");
const { connectDB, disconnectDB } = require("./config/database");
const app = require("./src/app");
const logger = require("./src/utils/logger");
const { startWorker } = require("./src/workers/withdrawal.worker");

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(config.port, () => logger.info("server.started", { port: config.port }));
    // worker runs in the same process by default, make runInApi = false
    const worker = config.worker.runInApi ? startWorker() : null;

    const shutdown = async (signal) => {
      logger.info("server.shutdown", { signal });
      server.close();
      if (worker) await worker.stop();
      await disconnectDB();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("server.start_failed", { error: error.message });
    process.exit(1);
  }
};

startServer();
