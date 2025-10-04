const db = require("../database.js");

const Document = {
  create: (name, userId) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION", (err) => {
          if (err) return reject(err);
        });

        const docSql = "INSERT INTO documents (name) VALUES (?)";
        db.run(docSql, [name], function (err) {
          if (err) {
            db.run("ROLLBACK");
            return reject(err);
          }
          const docId = this.lastID;

          const docUserSql =
            "INSERT INTO document_users (document_id, user_id, role) VALUES (?, ?, 'owner')";
          db.run(docUserSql, [docId, userId], (err) => {
            if (err) {
              db.run("ROLLBACK");
              return reject(err);
            }

            const snapSql =
              "INSERT INTO snapshots (document_id, content, snapshot_version, ot_version) VALUES (?, ?, 0, 0)";
            const initialContent = JSON.stringify([
              { type: "action", segments: [{ text: "" }] },
            ]);
            db.run(snapSql, [docId, initialContent], (err) => {
              if (err) {
                db.run("ROLLBACK");
                return reject(err);
              }
              db.run("COMMIT", (err) => {
                if (err) return reject(err);
                resolve({ id: docId });
              });
            });
          });
        });
      });
    });
  },
  findById: (id) => {
    return new Promise(async (resolve, reject) => {
      try {
        // First, get the latest OT version from the steps table
        const otVersionRow = await new Promise((res, rej) => {
          db.get(
            "SELECT MAX(ot_version) as max_ot_version FROM ot_steps WHERE document_id = ?",
            [id],
            (err, row) => {
              if (err) return rej(err);
              res(row);
            },
          );
        });

        const latest_ot_version = otVersionRow?.max_ot_version ?? 0;

        // Then, get the document and latest snapshot content
        const docSql = `
        SELECT 
          d.id, 
          d.name, 
          s.content, 
          s.snapshot_version, 
          s.ot_version as snapshot_ot_version
        FROM documents d
        LEFT JOIN snapshots s ON d.id = s.document_id
        WHERE d.id = ?
        ORDER BY s.snapshot_version DESC
        LIMIT 1;
      `;

        const docRow = await new Promise((res, rej) => {
          db.get(docSql, [id], (err, row) => {
            if (err) return rej(err);
            res(row);
          });
        });

        if (docRow) {
          docRow.ot_version = latest_ot_version;
        }

        resolve(docRow);
      } catch (err) {
        reject(err);
      }
    });
  },

  findByUser: (userId) => {
    return new Promise((resolve, reject) => {
      const sql = `
            SELECT d.id, d.name, du.role
            FROM documents d
            JOIN document_users du ON d.id = du.document_id
            WHERE du.user_id = ?
          `;
      db.all(sql, [userId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  countOwnedByUser: (userId) => {
    return new Promise((resolve, reject) => {
      const sql =
        "SELECT COUNT(*) as count FROM document_users WHERE user_id = ? AND role = 'owner'";
      db.get(sql, [userId], (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.count : 0);
      });
    });
  },

  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION", (err) => {
          if (err) return reject(err);
        });
        db.run("DELETE FROM ot_steps WHERE document_id = ?", id, (err) => {
          if (err) {
            db.run("ROLLBACK");
            return reject(err);
          }
        });
        db.run("DELETE FROM snapshots WHERE document_id = ?", id, (err) => {
          if (err) {
            db.run("ROLLBACK");
            return reject(err);
          }
        });
        db.run(
          "DELETE FROM document_users WHERE document_id = ?",
          id,
          (err) => {
            if (err) {
              db.run("ROLLBACK");
              return reject(err);
            }
          },
        );
        db.run("DELETE FROM documents WHERE id = ?", id, function (err) {
          if (err) {
            db.run("ROLLBACK");
            return reject(err);
          }
          db.run("COMMIT", (err) => {
            if (err) return reject(err);
            resolve({ changes: this.changes });
          });
        });
      });
    });
  },

  createSnapshot: (documentId, content, ot_version) => {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT MAX(snapshot_version) as max_snapshot_version FROM snapshots WHERE document_id = ?",
        [documentId],
        (err, row) => {
          if (err) return reject(err);
          const newSnapshotVersion = (row.max_snapshot_version || 0) + 1;
          const sql =
            "INSERT INTO snapshots (document_id, content, snapshot_version, ot_version) VALUES (?, ?, ?, ?)";
          db.run(
            sql,
            [documentId, content, newSnapshotVersion, ot_version],
            function (err) {
              if (err) return reject(err);
              resolve({ snapshot_version: newSnapshotVersion });
            },
          );
        },
      );
    });
  },

  getSteps: (documentId, since) => {
    return new Promise(async (resolve, reject) => {
      try {
        const snapshot = await new Promise((res, rej) => {
          db.get(
            `SELECT ot_version FROM snapshots WHERE document_id = ? ORDER BY snapshot_version DESC LIMIT 1`,
            [documentId],
            (err, row) => {
              if (err) return rej(err);
              res(row);
            },
          );
        });

        if (snapshot && (since || 0) < snapshot.ot_version) {
          return resolve({ error: "HISTORY_TOO_OLD" });
        }

        const sql =
          "SELECT * FROM ot_steps WHERE document_id = ? AND ot_version > ? ORDER BY ot_version ASC";
        db.all(sql, [documentId, since || 0], (err, rows) => {
          if (err) return reject(err);
          resolve({
            steps: rows.map((r) => JSON.parse(r.step)),
            ot_versions: rows.map((r) => r.ot_version),
            userIDs: rows.map((r) => r.user_id),
          });
        });
      } catch (err) {
        reject(err);
      }
    });
  },

  addCollaborator: (documentId, email) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
        if (err) return reject(err);
        if (!user) {
          return reject(new Error(`User with email ${email} not found`));
        }
        const userId = user.id;
        const sql =
          "INSERT INTO document_users (document_id, user_id, role) VALUES (?, ?, 'editor')";
        db.run(sql, [documentId, userId], function (err) {
          if (err) {
            if (err.code === "SQLITE_CONSTRAINT") {
              return reject(new Error("User is already a collaborator."));
            }
            return reject(err);
          }
          resolve({ success: true });
        });
      });
    });
  },

  removeCollaborator: (documentId, userId) => {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT role FROM document_users WHERE document_id = ? AND user_id = ?",
        [documentId, userId],
        (err, row) => {
          if (err) return reject(err);
          if (row && row.role === "owner") {
            return reject(
              new Error("Cannot remove the owner of the document."),
            );
          }
          const sql =
            "DELETE FROM document_users WHERE document_id = ? AND user_id = ?";
          db.run(sql, [documentId, userId], function (err) {
            if (err) return reject(err);
            if (this.changes === 0) {
              return reject(
                new Error("User is not a collaborator on this document."),
              );
            }
            resolve({ success: true });
          });
        },
      );
    });
  },

  getCollaborators: (documentId) => {
    return new Promise((resolve, reject) => {
      const sql = `
            SELECT u.id, u.email, du.role
            FROM users u
            JOIN document_users du ON u.id = du.user_id
            WHERE du.document_id = ?
          `;
      db.all(sql, [documentId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },
};

module.exports = Document;
