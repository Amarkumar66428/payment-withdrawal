const express = require("express");
const router = express.Router();

const requireAuth = require("../middlewares/auth");
const { authLimiter, withdrawalLimiter } = require("../middlewares/security");
const authController = require("../controllers/auth.controller");
const walletController = require("../controllers/wallet.controller");
const withdrawalController = require("../controllers/withdrawal.controller");

router.post("/auth/register", authLimiter, authController.register);
router.post("/auth/login", authLimiter, authController.login);

router.get("/wallet", requireAuth, walletController.getBalance);

router.post(
  "/withdrawals",
  requireAuth,
  withdrawalLimiter,
  withdrawalController.create,
);
router.get("/withdrawals", requireAuth, withdrawalController.list);
router.get("/withdrawals/:id", requireAuth, withdrawalController.get);

module.exports = router;
