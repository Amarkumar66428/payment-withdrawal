const { rateLimit } = require("express-rate-limit");
const config = require("../../config");
const AppError = require("../utils/AppError");

// block mongo operator {"$gt": 0} or "a.b" in body/query for queries security
const hasOperatorKey = (value, depth = 0) => {
  if (depth > 10) return true;
  if (Array.isArray(value))
    return value.some((v) => hasOperatorKey(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.keys(value).some(
      (k) =>
        k.startsWith("$") ||
        k.includes(".") ||
        k === "__proto__" ||
        hasOperatorKey(value[k], depth + 1),
    );
  }
  return false;
};

const rejectOperatorKeys = (req, res, next) => {
  if (hasOperatorKey(req.body) || hasOperatorKey(req.query)) {
    throw new AppError(400, "INVALID_INPUT", "Request contains forbidden keys");
  }
  next();
};

const limiter = (windowMs, limit, keyGenerator) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    handler: (req, res, next) =>
      next(new AppError(429, "RATE_LIMITED", "Too many requests")),
  });

// memory store is per instance, we can use redis for multiple instances
const authLimiter = limiter(15 * 60_000, 20);
const withdrawalLimiter = limiter(
  60_000,
  config.withdrawal.rateLimitPerMinute,
  (req) => String(req.userId),
);

module.exports = { rejectOperatorKeys, authLimiter, withdrawalLimiter };
