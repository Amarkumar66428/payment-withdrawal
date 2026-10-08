const mongoose = require("mongoose");
const logger = require("../utils/logger");
const AppError = require("../utils/AppError");
const { fingerprint } = require("../utils/crypto");
const { formatPaise } = require("../utils/money");
const { runInTransaction } = require("../utils/transaction");
const { withKeyLock } = require("../utils/keyedLock");
const userRepo = require("../repositories/user.repository");
const walletRepo = require("../repositories/wallet.repository");
const withdrawalRepo = require("../repositories/withdrawal.repository");
const logRepo = require("../repositories/transactionLog.repository");
const { STATUS } = require("../models/Withdrawal");
const { TXN_TYPE } = require("../models/TransactionLog");
const { USER_STATUS } = require("../models/User");

const DUPLICATE_KEY = 11000;

const replay = (existing, requestHash) => {
  if (existing.requestHash !== requestHash) {
    throw new AppError(
      422,
      "IDEMPOTENCY_KEY_REUSED",
      "This Idempotency-Key was already used with a different request",
    );
  }
  return { withdrawal: existing, replayed: true };
};

const requestWithdrawal = (userId, idempotencyKey, input) =>
  withKeyLock(userId, () => createWithdrawal(userId, idempotencyKey, input));

const createWithdrawal = async (
  userId,
  idempotencyKey,
  { amount, destination },
) => {
  const requestHash = fingerprint({ amount, destination });

  const seen = await withdrawalRepo.findByIdempotencyKey(
    userId,
    idempotencyKey,
  );
  if (seen) return replay(seen, requestHash);

  const current = await walletRepo.findByUserId(userId);
  if (current && current.balance < amount) {
    throw new AppError(
      422,
      "INSUFFICIENT_FUNDS",
      "Insufficient wallet balance",
    );
  }

  try {
    const result = await runInTransaction(async (session) => {
      const existing = await withdrawalRepo.findByIdempotencyKey(
        userId,
        idempotencyKey,
        session,
      );
      if (existing) return replay(existing, requestHash);

      const user = await userRepo.findById(userId, session);
      if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
      if (user.status !== USER_STATUS.ACTIVE) {
        throw new AppError(
          403,
          "USER_INACTIVE",
          "User is not allowed to withdraw",
        );
      }

      const wallet = await walletRepo.findByUserId(userId, session);
      if (!wallet)
        throw new AppError(404, "WALLET_NOT_FOUND", "Wallet not found");

      const debited = await walletRepo.debit(wallet._id, amount, session);
      if (!debited)
        throw new AppError(
          422,
          "INSUFFICIENT_FUNDS",
          "Insufficient wallet balance",
        );

      const withdrawalId = new mongoose.Types.ObjectId();
      const reference = `WD-${withdrawalId}`;
      const now = new Date();

      const withdrawal = await withdrawalRepo.create(
        {
          _id: withdrawalId,
          userId,
          walletId: wallet._id,
          amount,
          destination,
          status: STATUS.PENDING,
          idempotencyKey,
          requestHash,
          reference,
          nextAttemptAt: now,
        },
        session,
      );

      await logRepo.append(
        {
          userId,
          walletId: wallet._id,
          withdrawalId,
          type: TXN_TYPE.WITHDRAWAL_DEBIT,
          amount,
          balanceBefore: debited.balance + amount,
          balanceAfter: debited.balance,
          status: STATUS.PENDING,
          referenceId: reference,
        },
        session,
      );

      return { withdrawal, replayed: false };
    });

    if (!result.replayed) {
      logger.info("withdrawal.created", {
        withdrawalId: String(result.withdrawal._id),
        userId: String(userId),
        amount,
      });
    }
    return result;
  } catch (err) {
    if (err.code === DUPLICATE_KEY) {
      const existing = await withdrawalRepo.findByIdempotencyKey(
        userId,
        idempotencyKey,
      );
      if (existing) return replay(existing, requestHash);
    }
    throw err;
  }
};

const getWithdrawal = async (userId, id) => {
  if (!mongoose.isValidObjectId(id))
    throw new AppError(400, "VALIDATION_ERROR", "Invalid withdrawal id");
  const withdrawal = await withdrawalRepo.findForUser(id, userId);
  if (!withdrawal) throw new AppError(404, "NOT_FOUND", "Withdrawal not found");
  return withdrawal;
};

const listWithdrawals = (userId, limit) =>
  withdrawalRepo.listForUser(userId, limit);

const toDTO = (w) => ({
  id: w._id,
  reference: w.reference,
  amount: formatPaise(w.amount),
  amountPaise: w.amount,
  currency: w.currency,
  destination:
    w.destination.type === "bank"
      ? {
          type: "bank",
          accountNumber: `XXXX${w.destination.accountNumber.slice(-4)}`,
          ifsc: w.destination.ifsc,
        }
      : { type: "upi", upiId: w.destination.upiId },
  status: w.status,
  failureReason: w.failureReason,
  createdAt: w.createdAt,
  updatedAt: w.updatedAt,
  completedAt: w.completedAt,
});

module.exports = {
  requestWithdrawal,
  getWithdrawal,
  listWithdrawals,
  toDTO,
};
