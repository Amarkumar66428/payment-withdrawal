const { successResponse } = require("../utils/response");
const {
  parseCreateWithdrawal,
  parseIdempotencyKey,
} = require("../validators/withdrawal.validator");
const withdrawalService = require("../services/withdrawal.service");

const create = async (req, res) => {
  const idempotencyKey = parseIdempotencyKey(req.get("idempotency-key"));
  const input = parseCreateWithdrawal(req.body);

  const { withdrawal, replayed } = await withdrawalService.requestWithdrawal(
    req.userId,
    idempotencyKey,
    input,
  );

  res.set("Idempotent-Replayed", String(replayed));
  return successResponse(
    res,
    withdrawalService.toDTO(withdrawal),
    replayed
      ? "Duplicate request — returning original withdrawal"
      : "Withdrawal accepted",
    replayed ? 200 : 202,
  );
};

const get = async (req, res) => {
  const withdrawal = await withdrawalService.getWithdrawal(
    req.userId,
    req.params.id,
  );
  return successResponse(res, withdrawalService.toDTO(withdrawal));
};

const list = async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const rows = await withdrawalService.listWithdrawals(req.userId, limit);
  return successResponse(res, rows.map(withdrawalService.toDTO));
};

module.exports = { create, get, list };
