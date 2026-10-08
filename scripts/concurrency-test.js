// concurrency + security test, needs server running
// start server with WITHDRAWAL_RATE_LIMIT_PER_MIN=100000 npm start
// then run: npm run test:concurrency

const crypto = require("node:crypto");
const { connectDB, disconnectDB } = require("../config/database");
const Wallet = require("../src/models/Wallet");
const Withdrawal = require("../src/models/Withdrawal");
const TransactionLog = require("../src/models/TransactionLog");
const authService = require("../src/services/auth.service");
const walletService = require("../src/services/wallet.service");
const { reconcile } = require("./reconcile");

// can pass multiple urls separated by comma
const BASES = (process.env.BASE_URL || "http://localhost:3000/api/v1").split(
  ",",
);
const BASE = BASES[0];
let rr = 0;
const nextBase = () => BASES[rr++ % BASES.length];
const PARALLEL = Number(process.env.PARALLEL || 500);
const key = () => crypto.randomUUID();

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
};

const withdraw = (token, body, idemKey = key()) =>
  fetch(`${nextBase()}/withdrawals`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "idempotency-key": idemKey,
    },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

const count = (results, status) =>
  results.filter((r) => r.status === status).length;
const balanceOf = async (walletId) =>
  (await Wallet.findById(walletId).lean()).balance;
const upi = { type: "upi", upiId: "tester@okbank" };

(async () => {
  await connectDB();

  // create a new user and add money
  const email = `load-${Date.now()}@example.com`;
  const password = "Password@123";
  const user = await authService.register({ email, password });
  const wallet = await Wallet.findOne({ userId: user.id }).lean();

  await walletService.credit(
    wallet._id,
    user.id,
    1_000_00,
    `TEST-FUND-${user.id}`,
    "test funding",
  ); // ₹1000

  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());
  const token = login.data.token;
  console.log(`user ${email} funded with ₹1000\n`);

  // 1. many parallel ₹10 withdrawals on ₹1000 balance
  const started = Date.now();
  const burst = await Promise.all(
    Array.from({ length: PARALLEL }, () =>
      withdraw(token, { amount: "10", destination: upi }),
    ),
  );
  console.log(`[${PARALLEL} parallel requests in ${Date.now() - started}ms]`);
  // worker may refund failed ones during the test, so a few more than 100 can pass
  const accepted = count(burst, 202);
  console.log(`accepted ${accepted}, rejected ${count(burst, 422)}`);
  check(accepted >= 100, "at least ₹1000 worth accepted (100 x ₹10)");
  check(
    accepted + count(burst, 422) === PARALLEL,
    "every request is either accepted or INSUFFICIENT_FUNDS",
  );
  check(count(burst, 500) === 0, "no server errors");
  check((await balanceOf(wallet._id)) >= 0, "balance never negative");

  // 2. 50 parallel requests with same idempotency key
  await walletService.credit(
    wallet._id,
    user.id,
    500_00,
    `TEST-FUND2-${user.id}`,
    "test funding 2",
  ); // ₹500
  const sameKey = key();
  const replays = await Promise.all(
    Array.from({ length: 50 }, () =>
      withdraw(token, { amount: "50", destination: upi }, sameKey),
    ),
  );
  const ids = [
    ...new Set(
      replays.filter((r) => r.body.data).map((r) => String(r.body.data.id)),
    ),
  ];
  check(
    count(replays, 202) === 1,
    `same key x50 -> exactly one created (got ${count(replays, 202)})`,
  );
  check(
    count(replays, 200) === 49,
    `other 49 are replays (got ${count(replays, 200)})`,
  );
  check(ids.length === 1, "all responses reference the same withdrawal");
  const debits = await TransactionLog.countDocuments({
    withdrawalId: ids[0],
    type: TransactionLog.TXN_TYPE.WITHDRAWAL_DEBIT,
  });
  check(debits === 1, `debited exactly once (${debits} debit rows)`);

  // 3. same key but different amount
  const tampered = await withdraw(
    token,
    { amount: "51", destination: upi },
    sameKey,
  );
  check(
    tampered.status === 422 && tampered.body.code === "IDEMPOTENCY_KEY_REUSED",
    "key reuse with changed amount is rejected",
  );

  // 4. bad inputs
  const bad = [
    [
      { amount: "10", destination: upi, user_id: "64b000000000000000000000" },
      "user_id in body",
    ],
    [{ amount: "10", destination: upi, status: "success" }, "status in body"],
    [{ amount: { $gt: 0 }, destination: upi }, "operator injection in amount"],
    [
      { amount: "10", destination: { type: "upi", upiId: { $ne: null } } },
      "operator injection in destination",
    ],
    [{ amount: "-10", destination: upi }, "negative amount"],
    [{ amount: 0.30000000000000004, destination: upi }, "float amount"],
    [{ amount: "10.001", destination: upi }, "more than 2 decimals"],
  ];
  for (const [body, label] of bad) {
    const r = await withdraw(token, body);
    check(r.status === 400, `rejected: ${label} (${r.status} ${r.body.code})`);
  }
  const noKey = await fetch(`${BASE}/withdrawals`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amount: "10", destination: upi }),
  });
  check(noKey.status === 400, "rejected: missing Idempotency-Key");
  const forged = await withdraw(`${token.split(".")[0]}.forged`, {
    amount: "10",
    destination: upi,
  });
  check(forged.status === 401, "rejected: forged token");

  // 5. wait for worker to finish, then check ledger
  process.stdout.write("\nwaiting for worker to finish payouts");
  for (let i = 0; i < 120; i++) {
    const open = await Withdrawal.countDocuments({
      walletId: wallet._id,
      status: { $in: ["pending", "processing"] },
    });
    if (open === 0) break;
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log();
  const statuses = await Withdrawal.aggregate([
    { $match: { walletId: wallet._id } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  console.log(
    "final statuses:",
    Object.fromEntries(statuses.map((s) => [s._id, s.n])),
  );
  check(
    !statuses.some((s) => s._id === "pending" || s._id === "processing"),
    "all withdrawals reached a final state",
  );

  // added ₹1500 total, so balance should be 1500 - paid out
  const paidOut = (
    await Withdrawal.find({ walletId: wallet._id, status: "success" }).lean()
  ).reduce((s, w) => s + w.amount, 0);
  const finalBalance = await balanceOf(wallet._id);
  check(
    finalBalance === 1_500_00 - paidOut,
    `balance ₹${finalBalance / 100} == ₹1500 funded - ₹${paidOut / 100} paid out`,
  );

  const [result] = await reconcile({ _id: wallet._id });
  check(
    result.problems.length === 0,
    `ledger reconciles with balance (${result.rows} rows)${result.problems.length ? ": " + result.problems.join("; ") : ""}`,
  );

  console.log(
    `\n${failures ? `${failures} check(s) FAILED` : "all checks passed"}`,
  );
  await disconnectDB();
  process.exit(failures ? 1 : 0);
})().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
