const Withdrawal = require("../models/Withdrawal");
const { STATUS } = Withdrawal;

const create = (data, session) =>
  Withdrawal.create([data], { session }).then(([w]) => w.toObject());

const findByIdempotencyKey = (userId, idempotencyKey, session) =>
  Withdrawal.findOne({ userId, idempotencyKey })
    .session(session || null)
    .lean();

const findForUser = (id, userId) =>
  Withdrawal.findOne({ _id: id, userId }).lean();

const listForUser = (userId, limit) =>
  Withdrawal.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();

const claimNext = (workerId, lockMs) => {
  const now = new Date();
  return Withdrawal.findOneAndUpdate(
    {
      $or: [
        { status: STATUS.PENDING, nextAttemptAt: { $lte: now } },
        { status: STATUS.PROCESSING, lockedUntil: { $lt: now } },
      ],
    },
    {
      $set: {
        status: STATUS.PROCESSING,
        lockedBy: workerId,
        lockedUntil: new Date(now.getTime() + lockMs),
      },
      $inc: { attempts: 1 },
    },
    { sort: { nextAttemptAt: 1 }, returnDocument: "after" },
  ).lean();
};

const transitionFromProcessing = (
  id,
  workerId,
  toStatus,
  fields = {},
  session,
) =>
  Withdrawal.findOneAndUpdate(
    { _id: id, status: STATUS.PROCESSING, lockedBy: workerId },
    {
      $set: { status: toStatus, ...fields },
      $unset: { lockedBy: 1, lockedUntil: 1 },
    },
    { returnDocument: "after", session },
  ).lean();

module.exports = {
  create,
  findByIdempotencyKey,
  findForUser,
  listForUser,
  claimNext,
  transitionFromProcessing,
};
