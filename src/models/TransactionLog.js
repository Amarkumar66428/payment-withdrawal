const mongoose = require("mongoose");

const TXN_TYPE = Object.freeze({
  CREDIT: "CREDIT",
  WITHDRAWAL_DEBIT: "WITHDRAWAL_DEBIT",
  WITHDRAWAL_REFUND: "WITHDRAWAL_REFUND",
});

/** Append-only ledger: every balance change is recorded for audit and reconciliation. */
const transactionLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },
    withdrawalId: { type: mongoose.Schema.Types.ObjectId, ref: "Withdrawal" },
    type: { type: String, enum: Object.values(TXN_TYPE), required: true },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    status: { type: String, required: true },
    referenceId: { type: String, required: true },
    note: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    strict: "throw",
    versionKey: false,
  },
);

transactionLogSchema.index({ referenceId: 1, type: 1 }, { unique: true });
transactionLogSchema.index({ walletId: 1, createdAt: 1 });
transactionLogSchema.index({ userId: 1, createdAt: -1 });

const blockMutation = () => {
  throw new Error("transaction logs are insert-only");
};
const blockedOps = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
];
blockedOps.forEach((op) =>
  transactionLogSchema.pre(op, { document: false, query: true }, blockMutation),
);
transactionLogSchema.pre("save", function () {
  if (!this.isNew) blockMutation();
});

module.exports = mongoose.model(
  "TransactionLog",
  transactionLogSchema,
  "transaction_logs",
);
module.exports.TXN_TYPE = TXN_TYPE;
