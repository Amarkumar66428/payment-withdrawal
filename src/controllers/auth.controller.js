const { successResponse } = require("../utils/response");
const { parseCredentials } = require("../validators/auth.validator");
const authService = require("../services/auth.service");

// user register
const register = async (req, res) => {
  const user = await authService.register(parseCredentials(req.body));
  return successResponse(res, user, "Registered", 201);
};

// user login
const login = async (req, res) => {
  const result = await authService.login(parseCredentials(req.body));
  return successResponse(res, result, "Logged in");
};

module.exports = { register, login };
