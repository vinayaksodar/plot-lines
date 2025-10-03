const User = require("../models/user.js");

const signup = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user = await User.create(email, password);
    res.status(201).json({
      message: "success",
      id: user.id,
    });
  } catch (err) {
    // Check for unique constraint error
    if (err.code === "SQLITE_CONSTRAINT") {
      return res
        .status(409)
        .json({ error: "User with this email already exists." });
    }
    res.status(500).json({ error: "Failed to create user." });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const userData = await User.authenticate(email, password);
    if (userData) {
      res.json({
        message: "success",
        data: userData,
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ error: "Login failed." });
  }
};

module.exports = {
  signup,
  login,
};
