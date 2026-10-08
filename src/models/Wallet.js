const mongoose = require("mongoose");

/** One wallet per user. Balance is integer paise (₹1 = 100 paise). */
const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "balance must be integer paise",
      },
    },
    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
    },
  },
  { timestamps: true, strict: "throw" },
);

module.exports = mongoose.model("Wallet", walletSchema);
