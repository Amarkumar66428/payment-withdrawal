const crypto = require("node:crypto");
const { promisify } = require("node:util");
const config = require("../../config");

const scrypt = promisify(crypto.scrypt);

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
};

const verifyPassword = async (password, stored) => {
  const [salt, keyHex] = String(stored).split(":");
  if (!salt || !keyHex) return false;
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(keyHex, "hex");
  return (
    expected.length === key.length && crypto.timingSafeEqual(expected, key)
  );
};

const b64url = (input) => Buffer.from(input).toString("base64url");
const sign = (data) =>
  crypto
    .createHmac("sha256", config.auth.secret)
    .update(data)
    .digest("base64url");

// simple jwt like token: payload.signature
const issueToken = (userId) => {
  const payload = b64url(
    JSON.stringify({
      sub: String(userId),
      exp: Math.floor(Date.now() / 1000) + config.auth.tokenTtlSeconds,
    }),
  );
  return `${payload}.${sign(payload)}`;
};

const verifyToken = (token) => {
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (
    expected.length !== actual.length ||
    !crypto.timingSafeEqual(expected, actual)
  )
    return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      typeof claims.sub !== "string" ||
      claims.exp < Math.floor(Date.now() / 1000)
    )
      return null;
    return claims;
  } catch {
    return null;
  }
};

// hash of request body, to catch same idempotency key with different data
const fingerprint = (obj) =>
  crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");

module.exports = {
  hashPassword,
  verifyPassword,
  issueToken,
  verifyToken,
  fingerprint,
};
