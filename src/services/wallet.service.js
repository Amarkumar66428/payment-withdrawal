const AppError = require("../utils/AppError");
const { formatPaise } = require("../utils/money");
const { runInTransaction } = require("../utils/transaction");
const walletRepo = require("../repositories/wallet.repository");
const logRepo = require("../repositories/transactionLog.repository");
const { TXN_TYPE } = require("../models/TransactionLog");

const getWallet = async (userId) => {
  const wallet = await walletRepo.findByUserId(userId);
  if (!wallet) throw new AppError(404, "WALLET_NOT_FOUND", "Wallet not found");
  return {
    id: wallet._id,
    balance: formatPaise(wallet.balance),
    balancePaise: wallet.balance,
    currency: wallet.currency,
    updatedAt: wallet.updatedAt,
  };
};

// used by seed script, no api for this yet
const credit = (walletId, userId, amount, referenceId, note) =>
  runInTransaction(async (session) => {
    const wallet = await walletRepo.credit(walletId, amount, session);
    await logRepo.append(
      {
        userId,
        walletId,
        type: TXN_TYPE.CREDIT,
        amount,
        balanceBefore: wallet.balance - amount,
        balanceAfter: wallet.balance,
        status: "completed",
        referenceId,
        note,
      },
      session,
    );
    return wallet;
  });

module.exports = { getWallet, credit };
