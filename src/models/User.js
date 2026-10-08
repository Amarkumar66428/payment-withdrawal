const mongoose = require("mongoose");

const USER_STATUS = Object.freeze({ ACTIVE: "active", BLOCKED: "blocked" });

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
  },
  { timestamps: true, strict: "throw" },
);

module.exports = mongoose.model("User", userSchema);
module.exports.USER_STATUS = USER_STATUS;
