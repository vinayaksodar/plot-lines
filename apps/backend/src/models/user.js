const db = require("../database.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const saltRounds = 10;

const User = {
  create: async (email, password) => {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return new Promise((resolve, reject) => {
      const sql = "INSERT INTO users (email, password) VALUES (?,?)";
      db.run(sql, [email, hashedPassword], function (err) {
        if (err) {
          console.error("User creation failed:", err.message);
          return reject(err);
        }
        resolve({ id: this.lastID });
      });
    });
  },

  authenticate: (email, password) => {
    return new Promise((resolve, reject) => {
      const sql = "SELECT * FROM users WHERE email = ?";
      db.get(sql, [email], async (err, row) => {
        if (err) {
          console.error("User authentication failed:", err.message);
          return reject(err);
        }
        if (!row) {
          console.error(
            `Login failed: Invalid credentials for user '${email}'`,
          );
          return resolve(null); // User not found
        }

        const match = await bcrypt.compare(password, row.password);
        if (match) {
          const token = jwt.sign({ id: row.id }, process.env.JWT_SECRET, {
            expiresIn: "365d",
          });
          resolve({
            id: row.id,
            email: row.email,
            is_premium: row.is_premium,
            token: token,
          });
        } else {
          console.error(
            `Login failed: Invalid credentials for user '${email}'`,
          );
          resolve(null); // Passwords don't match
        }
      });
    });
  },

  // A simple finder method to be used by other parts of the app
  findById: (id) => {
    return new Promise((resolve, reject) => {
      const sql = "SELECT id, email, is_premium FROM users WHERE id = ?";
      db.get(sql, [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
};

module.exports = User;
