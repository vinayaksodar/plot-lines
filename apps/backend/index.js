const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const db = require("./src/database.js");

const app = express();
app.use(express.json());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = 3000;

function broadcast(documentId, message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ documentId, ...message }));
    }
  });
}

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (message) => {
    try {
      const { documentId, version, steps, clientID } = JSON.parse(message);

      db.get(
        "SELECT ot_version FROM documents WHERE id = ?",
        [documentId],
        (err, doc) => {
          if (err) {
            return ws.send(JSON.stringify({ error: err.message }));
          }
          if (!doc) {
            return ws.send(JSON.stringify({ error: "Document not found" }));
          }
          if (doc.ot_version !== version) {
            return ws.send(
              JSON.stringify({ error: "Version mismatch", documentId }),
            );
          }

          let newVersion = version;
          const promises = steps.map((step, i) => {
            return new Promise((resolve, reject) => {
              const stepVersion = version + i + 1;
              const sql =
                "INSERT INTO ot_steps (document_id, version, step, client_id) VALUES (?, ?, ?, ?)";
              db.run(
                sql,
                [documentId, stepVersion, JSON.stringify(step), clientID],
                (err) => {
                  if (err) return reject(err);
                  resolve();
                },
              );
            });
          });

          Promise.all(promises)
            .then(() => {
              newVersion += steps.length;
              db.run(
                "UPDATE documents SET ot_version = ? WHERE id = ?",
                [newVersion, documentId],
                (err) => {
                  if (err) {
                    return ws.send(JSON.stringify({ error: err.message }));
                  }
                  broadcast(documentId, {
                    steps,
                    clientID,
                    version: newVersion,
                  });
                  ws.send(
                    JSON.stringify({
                      message: "success",
                      version: newVersion,
                      documentId,
                    }),
                  );
                },
              );
            })
            .catch((err) => {
              ws.send(JSON.stringify({ error: err.message }));
            });
        },
      );
    } catch (e) {
      console.error("Failed to parse incoming message:", e);
      // Optionally send an error message back to the client
      ws.send(JSON.stringify({ error: "Invalid message format" }));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

app.get("/api/documents/:id", (req, res) => {
  const sql = "select * from documents where id = ?";
  const params = [req.params.id];
  db.get(sql, params, (err, row) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({
      message: "success",
      data: row,
    });
  });
});

app.post("/api/documents", (req, res) => {
  const { name, userId } = req.body;
  if (!name) {
    return res.status(400).json({ error: "No name specified" });
  }
  if (!userId) {
    return res.status(400).json({ error: "No userId specified" });
  }

  db.get("SELECT is_premium FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!user || !user.is_premium) {
      return res.json({ message: "not-premium" });
    }

    const data = {
      name: name,
      content: req.body.content || "",
      user_id: userId,
    };
    const sql = "INSERT INTO documents (name, content, user_id) VALUES (?,?,?)";
    const params = [data.name, data.content, data.user_id];
    db.run(sql, params, function (err, result) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({
        message: "success",
        data: data,
        id: this.lastID,
      });
    });
  });
});

app.get("/api/users/:userId/documents", (req, res) => {
  const { userId } = req.params;
  const sql = "SELECT * FROM documents WHERE user_id = ?";
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({
      message: "success",
      data: rows,
    });
  });
});

app.put("/api/documents/:id", (req, res) => {
  const { content, ot_version } = req.body;
  const id = req.params.id;

  db.get(
    "SELECT snapshot_version FROM documents WHERE id = ?",
    [id],
    (err, row) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: "Document not found" });
      }

      const newSnapshotVersion = row.snapshot_version + 1;
      const sql =
        "UPDATE documents SET content = ?, snapshot_version = ?, ot_version = ? WHERE id = ?";
      const params = [content, newSnapshotVersion, ot_version, id];
      db.run(sql, params, function (err, result) {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
        res.json({
          message: "success",
          snapshot_version: newSnapshotVersion,
        });
      });
    },
  );
});

app.get("/api/documents/:id/steps", (req, res) => {
  const { since } = req.query;
  const documentId = req.params.id;

  const sql =
    "SELECT * FROM ot_steps WHERE document_id = ? AND version > ? ORDER BY version ASC";
  db.all(sql, [documentId, since || 0], (err, rows) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({
      message: "success",
      steps: rows.map((r) => JSON.parse(r.step)),
      versions: rows.map((r) => r.version),
      clientIDs: rows.map((r) => r.client_id),
    });
  });
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.delete("/api/documents/:id", (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM documents WHERE id = ?", id, function (err, result) {
    if (err) {
      res.status(400).json({ error: res.message });
      return;
    }
    res.json({ message: "deleted", changes: this.changes });
  });
});

app.post("/api/signup", (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: "Name and password are required" });
  }
  // In a real app, you should hash the password
  const sql = "INSERT INTO users (name, password) VALUES (?,?)";
  db.run(sql, [name, password], function (err, result) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({
      message: "success",
      id: this.lastID,
    });
  });
});

app.post("/api/login", (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: "Name and password are required" });
  }
  const sql = "SELECT * FROM users WHERE name = ? AND password = ?";
  db.get(sql, [name, password], (err, row) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!row) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    res.json({
      message: "success",
      data: {
        id: row.id,
        name: row.name,
        is_premium: row.is_premium,
      },
    });
  });
});

server.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
