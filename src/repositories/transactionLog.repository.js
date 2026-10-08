const TransactionLog = require("../models/TransactionLog");

const append = (entry, session) =>
  TransactionLog.create([entry], { session }).then(([l]) => l.toObject());

const listForWallet = (walletId) =>
  TransactionLog.find({ walletId }).sort({ createdAt: 1, _id: 1 }).lean();

module.exports = { append, listForWallet };
