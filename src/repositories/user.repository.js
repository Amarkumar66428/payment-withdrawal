const User = require("../models/User");

const create = (data, session) =>
  User.create([data], { session }).then(([u]) => u.toObject());

const findByEmailWithPassword = (email) =>
  User.findOne({ email }).select("+password").lean();

const findById = (id, session) =>
  User.findById(id)
    .session(session || null)
    .lean();

module.exports = { create, findByEmailWithPassword, findById };
