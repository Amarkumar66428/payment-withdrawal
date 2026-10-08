const Wallet = require("../models/Wallet");

const findByUserId = (userId, session) =>
  Wallet.findOne({ userId })
    .session(session || null)
    .lean();

/** Atomic debit: returns updated wallet or null if balance is too low. */
const debit = (walletId, amount, session) =>
  Wallet.findOneAndUpdate(
    { _id: walletId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { returnDocument: "after", session },
  ).lean();

const credit = (walletId, amount, session) =>
  Wallet.findOneAndUpdate(
    { _id: walletId },
    { $inc: { balance: amount } },
    { returnDocument: "after", session },
  ).lean();

const create = (userId, session) =>
  Wallet.create([{ userId }], { session }).then(([w]) => w.toObject());

module.exports = { findByUserId, debit, credit, create };
