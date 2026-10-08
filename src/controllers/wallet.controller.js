const { successResponse } = require("../utils/response");
const walletService = require("../services/wallet.service");

const getBalance = async (req, res) =>
  successResponse(res, await walletService.getWallet(req.userId));

module.exports = { getBalance };
