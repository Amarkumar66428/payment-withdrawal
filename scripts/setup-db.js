// creates collections with validators and indexes: npm run db:setup

const mongoose = require("mongoose");

// we create collections here ourselves
mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);

const { connectDB, disconnectDB } = require("../config/database");
const User = require("../src/models/User");
const Wallet = require("../src/models/Wallet");
const Withdrawal = require("../src/models/Withdrawal");
const TransactionLog = require("../src/models/TransactionLog");

const money = { bsonType: ["int", "long", "double"], multipleOf: 1 };

const validators = {
  wallets: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "balance", "currency"],
      properties: {
        userId: { bsonType: "objectId" },
        balance: { ...money, minimum: 0 },
        currency: { enum: ["INR"] },
      },
    },
  },
  withdrawals: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "userId",
        "walletId",
        "amount",
        "status",
        "idempotencyKey",
        "reference",
      ],
      properties: {
        amount: { ...money, minimum: 1 },
        status: { enum: Object.values(Withdrawal.STATUS) },
      },
    },
  },
  transaction_logs: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "userId",
        "walletId",
        "type",
        "amount",
        "balanceBefore",
        "balanceAfter",
        "status",
        "referenceId",
        "createdAt",
      ],
      properties: {
        type: { enum: Object.values(TransactionLog.TXN_TYPE) },
        amount: { ...money, minimum: 1 },
        balanceBefore: { ...money, minimum: 0 },
        balanceAfter: { ...money, minimum: 0 },
      },
    },
  },
};

(async () => {
  await connectDB();
  const db = mongoose.connection.db;
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (c) => c.name,
    ),
  );

  for (const name of ["users", "wallets", "withdrawals", "transaction_logs"]) {
    const validator = validators[name];
    if (!existing.has(name)) {
      await db.createCollection(
        name,
        validator ? { validator, validationLevel: "strict" } : {},
      );
      console.log(`created collection ${name}`);
    } else if (validator) {
      await db.command({ collMod: name, validator, validationLevel: "strict" });
      console.log(`updated validator on ${name}`);
    }
  }

  for (const model of [User, Wallet, Withdrawal, TransactionLog]) {
    await model.syncIndexes();
    console.log(`indexes synced for ${model.collection.name}`);
  }

  await disconnectDB();
  console.log("database setup complete");
})().catch(async (err) => {
  console.error("setup failed:", err.message);
  await disconnectDB();
  process.exit(1);
});
