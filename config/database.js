const mongoose = require("mongoose");
const config = require("./index");
const logger = require("../src/utils/logger");

mongoose.set("strictQuery", "throw");

const connectDB = async () => {
  const connection = await mongoose.connect(config.mongoUri);

  // transactions only work on a replica set, so check it at startup
  const hello = await connection.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") {
    throw new Error("MongoDB must run as a replica set, see README");
  }

  logger.info("mongodb.connected", { replicaSet: hello.setName || "sharded" });
  return connection;
};

const disconnectDB = () => mongoose.disconnect();

module.exports = { connectDB, disconnectDB };
