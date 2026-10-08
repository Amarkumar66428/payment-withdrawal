// checks wallet balance matches the transaction logs: npm run reconcile

const Wallet = require("../src/models/Wallet");
const Withdrawal = require("../src/models/Withdrawal");
const TransactionLog = require("../src/models/TransactionLog");

const { TXN_TYPE } = TransactionLog;
const { STATUS } = Withdrawal;
const SIGN = {
  [TXN_TYPE.CREDIT]: 1,
  [TXN_TYPE.WITHDRAWAL_REFUND]: 1,
  [TXN_TYPE.WITHDRAWAL_DEBIT]: -1,
};

const reconcileWallet = async (wallet) => {
  const problems = [];
  const logs = await TransactionLog.find({ walletId: wallet._id }).lean();

  // balance should equal sum of logs
  const ledgerBalance = logs.reduce(
    (sum, l) => sum + SIGN[l.type] * l.amount,
    0,
  );
  if (ledgerBalance !== wallet.balance)
    problems.push(`balance ${wallet.balance} != ledger ${ledgerBalance}`);

  for (const l of logs) {
    if (l.balanceAfter - l.balanceBefore !== SIGN[l.type] * l.amount)
      problems.push(`row ${l._id} before/after mismatch`);
    if (l.balanceAfter < 0 || l.balanceBefore < 0)
      problems.push(`row ${l._id} negative balance`);
  }

  // each withdrawal has one debit, and one refund only if it failed
  const byRef = new Map();
  for (const l of logs) {
    if (!byRef.has(l.referenceId)) byRef.set(l.referenceId, []);
    byRef.get(l.referenceId).push(l.type);
  }
  const withdrawals = await Withdrawal.find({ walletId: wallet._id }).lean();
  for (const w of withdrawals) {
    const types = byRef.get(w.reference) || [];
    const debits = types.filter((t) => t === TXN_TYPE.WITHDRAWAL_DEBIT).length;
    const refunds = types.filter(
      (t) => t === TXN_TYPE.WITHDRAWAL_REFUND,
    ).length;
    if (debits !== 1) problems.push(`withdrawal ${w._id} has ${debits} debits`);
    if (refunds !== (w.status === STATUS.FAILED ? 1 : 0))
      problems.push(`withdrawal ${w._id} (${w.status}) has ${refunds} refunds`);
  }

  return {
    walletId: String(wallet._id),
    balance: wallet.balance,
    rows: logs.length,
    withdrawals: withdrawals.length,
    problems,
  };
};

const reconcile = async (filter = {}) => {
  const wallets = await Wallet.find(filter).lean();
  return Promise.all(wallets.map(reconcileWallet));
};

module.exports = { reconcile };

if (require.main === module) {
  const { connectDB, disconnectDB } = require("../config/database");
  (async () => {
    await connectDB();
    const results = await reconcile();
    const bad = results.filter((r) => r.problems.length);
    for (const r of bad)
      console.log(
        `MISMATCH wallet ${r.walletId}:\n  - ${r.problems.join("\n  - ")}`,
      );
    console.log(
      `reconciled ${results.length} wallet(s): ${bad.length ? `${bad.length} with problems` : "all consistent"}`,
    );
    await disconnectDB();
    process.exit(bad.length ? 1 : 0);
  })();
}
