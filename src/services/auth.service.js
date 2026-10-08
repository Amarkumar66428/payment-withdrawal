const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { hashPassword, verifyPassword, issueToken } = require("../utils/crypto");
const { runInTransaction } = require("../utils/transaction");
const userRepo = require("../repositories/user.repository");
const walletRepo = require("../repositories/wallet.repository");
const { USER_STATUS } = require("../models/User");

// user register
const register = async ({ email, password }) => {
  const passwordHash = await hashPassword(password);
  try {
    const user = await runInTransaction(async (session) => {
      const created = await userRepo.create(
        { email, password: passwordHash },
        session,
      );
      await walletRepo.create(created._id, session);
      return created;
    });
    logger.info("user.registered", { userId: String(user._id) });
    return { id: user._id, email: user.email };
  } catch (err) {
    if (err.code === 11000)
      throw new AppError(409, "EMAIL_TAKEN", "Email is already registered");
    throw err;
  }
};

// user login
const login = async ({ email, password }) => {
  const user = await userRepo.findByEmailWithPassword(email);
  if (!user || !(await verifyPassword(password, user.password))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");
  }
  if (user.status !== USER_STATUS.ACTIVE)
    throw new AppError(403, "USER_INACTIVE", "User is blocked");
  return {
    token: issueToken(user._id),
    user: { id: user._id, email: user.email },
  };
};

module.exports = { register, login };
