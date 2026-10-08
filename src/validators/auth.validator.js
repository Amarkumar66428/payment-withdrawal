const AppError = require("../utils/AppError");

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

const parseCredentials = (body) => {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError(400, "VALIDATION_ERROR", "Body must be a JSON object");
  }
  const extra = Object.keys(body).filter(
    (k) => k !== "email" && k !== "password",
  );
  if (extra.length)
    throw new AppError(
      400,
      "UNKNOWN_FIELDS",
      `Unexpected field(s): ${extra.join(", ")}`,
    );

  const { email, password } = body;
  if (typeof email !== "string" || !EMAIL.test(email)) {
    throw new AppError(400, "VALIDATION_ERROR", "A valid email is required");
  }
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "password must be 8-128 characters",
    );
  }
  return { email: email.trim().toLowerCase(), password };
};

module.exports = { parseCredentials };
