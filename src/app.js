const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const mongoose = require("mongoose");
const routes = require("./routes");
const { rejectOperatorKeys } = require("./middlewares/security");
const { notFound, errorHandler } = require("./middlewares/errorHandler");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1); // needed for rate limit behind proxy
app.set("query parser", "simple");

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb", strict: true }));
app.use(rejectOperatorKeys);

app.get("/health", (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    success: dbUp,
    message: dbUp ? "Server is running" : "Database unavailable",
  });
});

app.use("/api/v1", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
