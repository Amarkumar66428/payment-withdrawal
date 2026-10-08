const mongoose = require("mongoose");
const AppError = require("../utils/AppError");
const { verifyToken } = require("../utils/crypto");

const requireAuth = (req, res, next) => {
  const [scheme, token] = (req.get("authorization") || "").split(" ");
  const claims = scheme === "Bearer" && token ? verifyToken(token) : null;
  if (!claims || !mongoose.isValidObjectId(claims.sub)) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or invalid token");
  }
  req.userId = new mongoose.Types.ObjectId(claims.sub);
  next();
};

module.exports = requireAuth;
