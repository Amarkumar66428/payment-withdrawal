const config = require("../../config");
const AppError = require("../utils/AppError");
const { toPaise } = require("../utils/money");

const UPI_ID = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/;
const ACCOUNT_NUMBER = /^\d{9,18}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,64}$/;

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const assertOnlyKeys = (obj, allowed, where) => {
  const extra = Object.keys(obj).filter((k) => !allowed.includes(k));
  if (extra.length)
    throw new AppError(
      400,
      "UNKNOWN_FIELDS",
      `Unexpected field(s) in ${where}: ${extra.join(", ")}`,
    );
};

const parseDestination = (d) => {
  if (!isPlainObject(d))
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "destination must be an object",
    );

  if (d.type === "upi") {
    assertOnlyKeys(d, ["type", "upiId"], "destination");
    if (typeof d.upiId !== "string" || !UPI_ID.test(d.upiId)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "destination.upiId is invalid",
      );
    }
    return { type: "upi", upiId: d.upiId.toLowerCase() };
  }

  if (d.type === "bank") {
    assertOnlyKeys(d, ["type", "accountNumber", "ifsc"], "destination");
    if (
      typeof d.accountNumber !== "string" ||
      !ACCOUNT_NUMBER.test(d.accountNumber)
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "destination.accountNumber must be 9-18 digits",
      );
    }
    if (typeof d.ifsc !== "string" || !IFSC.test(d.ifsc)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "destination.ifsc is invalid",
      );
    }
    return { type: "bank", accountNumber: d.accountNumber, ifsc: d.ifsc };
  }

  throw new AppError(
    400,
    "VALIDATION_ERROR",
    "destination.type must be 'upi' or 'bank'",
  );
};

const parseCreateWithdrawal = (body) => {
  if (!isPlainObject(body))
    throw new AppError(400, "VALIDATION_ERROR", "Body must be a JSON object");
  assertOnlyKeys(body, ["amount", "destination"], "body");

  const amount = toPaise(body.amount);
  if (amount === null) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "amount must be a positive number with at most 2 decimals",
    );
  }
  const { minPaise, maxPaise } = config.withdrawal;
  if (amount < minPaise || amount > maxPaise) {
    throw new AppError(
      400,
      "AMOUNT_OUT_OF_RANGE",
      `amount must be between ${minPaise / 100} and ${maxPaise / 100}`,
    );
  }

  return { amount, destination: parseDestination(body.destination) };
};

const parseIdempotencyKey = (value) => {
  if (typeof value !== "string" || !IDEMPOTENCY_KEY.test(value)) {
    throw new AppError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key header (16-64 chars: A-Z a-z 0-9 _ -) is required",
    );
  }
  return value;
};

module.exports = { parseCreateWithdrawal, parseIdempotencyKey };
