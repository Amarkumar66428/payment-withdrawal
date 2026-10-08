require("dotenv").config({ quiet: true });

const int = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed))
    throw new Error(`${name} must be an integer`);
  return parsed;
};

const num = (name, fallback) => {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : Number(value);
};

const env = process.env.NODE_ENV || "development";

const config = {
  env,
  port: int("PORT", 3000),
  mongoUri: (process.env.MONGODB_URI || "").trim(),
  auth: {
    secret:
      process.env.AUTH_SECRET ||
      (env === "production" ? "" : "dev-only-secret"),
    tokenTtlSeconds: int("TOKEN_TTL_SECONDS", 3600),
  },
  withdrawal: {
    minPaise: 100,
    maxPaise: 10_000_000,
    rateLimitPerMinute: 30,
  },
  worker: {
    runInApi: true,
    concurrency: 5,
    pollMs: 500,
    lockMs: 30_000,
    maxAttempts: 5,
  },
  gateway: {
    failRate: 0.1,
    transientRate: 0.1,
  },
};

if (!config.mongoUri) throw new Error("MONGODB_URI is required");
if (!config.auth.secret)
  throw new Error("AUTH_SECRET is required in production");

module.exports = config;
