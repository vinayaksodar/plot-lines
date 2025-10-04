const sqlite3 = require("sqlite3").verbose();
const DBSOURCE = "main.db";

let db = new sqlite3.Database(DBSOURCE, (err) => {
  if (err) {
    // Cannot open database
    console.error(err.message);
    throw err;
  } else {
    console.log("Connected to the SQLite database.");
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                is_premium BOOLEAN NOT NULL DEFAULT 0
              )`);

      db.run(`CREATE TABLE IF NOT EXISTS documents (
                name TEXT NOT NULL,
                id INTEGER PRIMARY KEY AUTOINCREMENT
              )`);

      db.run(`CREATE TABLE IF NOT EXISTS document_users (
                document_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('owner', 'editor')),
                FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                PRIMARY KEY (document_id, user_id)
            )`);

      db.run(`CREATE TABLE IF NOT EXISTS snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER NOT NULL,
                content TEXT,
                snapshot_version INTEGER NOT NULL,
                ot_version INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
            )`);

      db.run(`CREATE TABLE IF NOT EXISTS ot_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER NOT NULL,
                ot_version INTEGER NOT NULL,
                step TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`);
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_ot_steps_document_version ON ot_steps (document_id, ot_version)`,
      );
      // Insert a default premium user for testing
      db.get("SELECT * FROM users WHERE id = 1", (err, row) => {
        if (!row) {
          db.run(
            "INSERT INTO users (id, email, password, is_premium) VALUES (1, 'user@email.com', 'password', 1)",
          );
        }
      });
    });
  }
});

module.exports = db;
