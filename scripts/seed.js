// adds some test users: npm run db:seed
// safe to run again, credit won't be added twice

const { connectDB, disconnectDB } = require("../config/database");
const User = require("../src/models/User");
const Wallet = require("../src/models/Wallet");
const { hashPassword } = require("../src/utils/crypto");
const walletService = require("../src/services/wallet.service");

const PASSWORD = "Password@123";
const USERS = [
  { email: "alice@example.com", balancePaise: 10_000_00, status: "active" },
  { email: "carol@example.com", balancePaise: 1_000_00, status: "active" },
  { email: "bob@example.com", balancePaise: 500_00, status: "blocked" },
];

(async () => {
  await connectDB();

  for (const u of USERS) {
    let user = await User.findOne({ email: u.email });
    if (!user)
      user = await User.create({
        email: u.email,
        password: await hashPassword(PASSWORD),
        status: u.status,
      });

    const wallet =
      (await Wallet.findOne({ userId: user._id })) ||
      (await Wallet.create({ userId: user._id }));

    try {
      await walletService.credit(
        wallet._id,
        user._id,
        u.balancePaise,
        `SEED-${u.email}`,
        "initial seed balance",
      );
      console.log(
        `seeded ${u.email} (${u.status}) with ₹${u.balancePaise / 100}`,
      );
    } catch (err) {
      if (err.code !== 11000) throw err;
      console.log(`${u.email} already seeded, skipping credit`);
    }
  }

  console.log(`\nAll seed users use password: ${PASSWORD}`);
  await disconnectDB();
})().catch(async (err) => {
  console.error("seed failed:", err.message);
  await disconnectDB();
  process.exit(1);
});
