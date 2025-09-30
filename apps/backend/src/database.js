const sqlite3 = require("sqlite3").verbose();
const DBSOURCE = "main.db";

let db = new sqlite3.Database(DBSOURCE, (err) => {
  if (err) {
    // Cannot open database
    console.error(err.message);
    throw err;
  } else {
    console.log("Connected to the SQLite database.");
    db.run(`CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name text
            )`);
    db.run(`CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            content TEXT,
            snapshot_version INTEGER NOT NULL DEFAULT 0,
            ot_version INTEGER NOT NULL DEFAULT 0
          )`);
    db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            password TEXT NOT NULL,
            is_premium BOOLEAN NOT NULL DEFAULT 0
          )`);
    db.run(`CREATE TABLE IF NOT EXISTS ot_steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            version INTEGER NOT NULL,
            step TEXT NOT NULL,
            client_id TEXT NOT NULL
        )`);

    // Insert a default premium user for testing
    db.get("SELECT * FROM users WHERE id = 1", (err, row) => {
      if (!row) {
        db.run(
          "INSERT INTO users (id, name, password, is_premium) VALUES (1, 'Premium User', 'password', 1)",
        );
      }
    });
  }
});

module.exports = db;
