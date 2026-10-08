const mongoose = require("mongoose");

const STATUS = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  SUCCESS: "success",
  FAILED: "failed",
});

const destinationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["upi", "bank"], required: true },
    upiId: String,
    accountNumber: String,
    ifsc: String,
  },
  { _id: false, strict: "throw" },
);

const withdrawalSchema = new mongoose.Schema(
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
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    currency: { type: String, enum: ["INR"], default: "INR" },
    destination: { type: destinationSchema, required: true },

    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.PENDING,
    },

    idempotencyKey: { type: String, required: true },
    requestHash: { type: String, required: true },
    reference: { type: String, required: true, unique: true },

    gatewayTxnId: String,
    failureReason: String,

    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lockedBy: String,
    lockedUntil: Date,
    lastError: String,
    completedAt: Date,
  },
  { timestamps: true, strict: "throw" },
);

withdrawalSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
withdrawalSchema.index({ userId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, nextAttemptAt: 1 });
withdrawalSchema.index({ status: 1, lockedUntil: 1 });

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
module.exports.STATUS = STATUS;
