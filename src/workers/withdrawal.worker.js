const os = require("node:os");
const crypto = require("node:crypto");
const config = require("../../config");
const logger = require("../utils/logger");
const { processNext } = require("../services/withdrawal.processor");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const startWorker = () => {
  const workerId = `${os.hostname()}-${process.pid}-${crypto.randomBytes(3).toString("hex")}`;
  let running = true;

  const loop = async (slot) => {
    while (running) {
      try {
        const didWork = await processNext(workerId);
        if (!didWork) await sleep(config.worker.pollMs);
      } catch (err) {
        logger.error("worker.loop_error", {
          workerId,
          slot,
          error: err.message,
        });
        await sleep(config.worker.pollMs);
      }
    }
  };

  const loops = Array.from({ length: config.worker.concurrency }, (_, i) =>
    loop(i),
  );
  logger.info("worker.started", {
    workerId,
    concurrency: config.worker.concurrency,
  });

  return {
    stop: async () => {
      running = false;
      await Promise.all(loops);
      logger.info("worker.stopped", { workerId });
    },
  };
};

module.exports = { startWorker };
