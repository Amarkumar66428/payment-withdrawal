// same as rs.initiate() in mongosh, run once: npm run db:init-rs

const { MongoClient } = require("mongodb");

const host = process.env.MONGO_HOST || "localhost:27017";

(async () => {
  const client = await MongoClient.connect(
    `mongodb://${host}/?directConnection=true`,
    { serverSelectionTimeoutMS: 5000 },
  );
  const admin = client.db("admin");

  try {
    await admin.command({
      replSetInitiate: { _id: "rs0", members: [{ _id: 0, host }] },
    });
    console.log(`replica set rs0 initiated on ${host}`);
  } catch (err) {
    if (err.codeName === "AlreadyInitialized")
      console.log("replica set already initiated");
    else if (err.codeName === "NoReplicationEnabled") {
      throw new Error(
        "mongod is not started with replication.replSetName: rs0 (see README > Quick start)",
      );
    } else throw err;
  }

  for (let i = 0; i < 30; i++) {
    if ((await admin.command({ hello: 1 })).isWritablePrimary) {
      console.log("primary is ready");
      return client.close();
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  await client.close();
  throw new Error("timed out waiting for primary");
})().catch((err) => {
  console.error("init failed:", err.message);
  process.exit(1);
});
