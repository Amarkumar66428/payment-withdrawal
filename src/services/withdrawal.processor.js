const config = require("../../config");
const logger = require("../utils/logger");
const { runInTransaction } = require("../utils/transaction");
const { withKeyLock } = require("../utils/keyedLock");
const walletRepo = require("../repositories/wallet.repository");
const withdrawalRepo = require("../repositories/withdrawal.repository");
const logRepo = require("../repositories/transactionLog.repository");
const mockGateway = require("./mockGateway");
const { STATUS } = require("../models/Withdrawal");
const { TXN_TYPE } = require("../models/TransactionLog");

const backoffMs = (attempts) => Math.min(60_000, 1000 * 2 ** (attempts - 1));

const markSuccess = async (job, workerId, gatewayTxnId) => {
  const done = await withdrawalRepo.transitionFromProcessing(
    job._id,
    workerId,
    STATUS.SUCCESS,
    { gatewayTxnId, completedAt: new Date() },
  );
  if (done)
    logger.info("withdrawal.success", {
      withdrawalId: String(job._id),
      gatewayTxnId,
    });
  else
    logger.warn("withdrawal.lock_lost", {
      withdrawalId: String(job._id),
      workerId,
    });
};

const markFailedAndRefund = async (job, workerId, reason) => {
  const refunded = await withKeyLock(job.userId, () =>
    runInTransaction(async (session) => {
      const failed = await withdrawalRepo.transitionFromProcessing(
        job._id,
        workerId,
        STATUS.FAILED,
        { failureReason: reason, completedAt: new Date() },
        session,
      );
      if (!failed) return false;

      const wallet = await walletRepo.credit(job.walletId, job.amount, session);
      await logRepo.append(
        {
          userId: job.userId,
          walletId: job.walletId,
          withdrawalId: job._id,
          type: TXN_TYPE.WITHDRAWAL_REFUND,
          amount: job.amount,
          balanceBefore: wallet.balance - job.amount,
          balanceAfter: wallet.balance,
          status: STATUS.FAILED,
          referenceId: job.reference,
          note: reason,
        },
        session,
      );
      return true;
    }),
  );

  if (refunded)
    logger.warn("withdrawal.failed_refunded", {
      withdrawalId: String(job._id),
      reason,
    });
  else
    logger.warn("withdrawal.lock_lost", {
      withdrawalId: String(job._id),
      workerId,
    });
};

const scheduleRetry = async (job, workerId, error) => {
  const retry = await withdrawalRepo.transitionFromProcessing(
    job._id,
    workerId,
    STATUS.PENDING,
    {
      nextAttemptAt: new Date(Date.now() + backoffMs(job.attempts)),
      lastError: error,
    },
  );
  if (retry)
    logger.warn("withdrawal.retry_scheduled", {
      withdrawalId: String(job._id),
      attempts: job.attempts,
      error,
    });
};

const processNext = async (workerId) => {
  const job = await withdrawalRepo.claimNext(workerId, config.worker.lockMs);
  if (!job) return false;

  let result;
  try {
    result = await mockGateway.payout({
      reference: job.reference,
      amount: job.amount,
      currency: job.currency,
      destination: job.destination,
    });
  } catch (err) {
    if (!(err instanceof mockGateway.GatewayTransientError)) {
      logger.error("gateway.unexpected_error", {
        withdrawalId: String(job._id),
        error: err.message,
      });
    }
    if (job.attempts < config.worker.maxAttempts)
      await scheduleRetry(job, workerId, err.message);
    else
      await markFailedAndRefund(
        job,
        workerId,
        `MAX_RETRIES_EXCEEDED: ${err.message}`,
      );
    return true;
  }

  if (result.status === "success")
    await markSuccess(job, workerId, result.gatewayTxnId);
  else await markFailedAndRefund(job, workerId, result.reason);
  return true;
};

module.exports = { processNext };
