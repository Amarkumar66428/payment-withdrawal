const express = require('express');
const router = express.Router();
const authController = require('../../controllers/user.controller');

router.post("/register", userController.registerUser);

router.post("/login", userController.loginUser);

module.exports = router;