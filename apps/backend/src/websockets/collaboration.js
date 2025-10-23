const WebSocket = require("ws");
const db = require("../database.js");

function broadcast(wss, documentId, message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // TODO: This is inefficient and insecure.
      // Only send to clients subscribed to this documentId.
      client.send(JSON.stringify({ documentId, ...message }));
    }
  });
}

function setupCollaboration(wss) {
  wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", (message) => {
      try {
        const { documentId, ot_version, steps, userID, cursor } = JSON.parse(message);

        if (cursor) {
          broadcast(wss, documentId, { userID, cursor });
          return;
        }

        db.serialize(() => {
          db.get(
            "SELECT MAX(ot_version) as latest_ot_version FROM ot_steps WHERE document_id = ?",
            [documentId],
            (err, row) => {
              if (err) {
                return ws.send(JSON.stringify({ error: err.message }));
              }
              const latest_ot_version = row ? row.latest_ot_version || 0 : 0;
              if (latest_ot_version !== ot_version) {
                return ws.send(
                  JSON.stringify({ error: "OT Version mismatch", documentId }),
                );
              }

              if (!Array.isArray(steps)) {
                return;
              }

              let new_ot_version = ot_version;
              const promises = steps.map((step, i) => {
                return new Promise((resolve, reject) => {
                  const step_ot_version = ot_version + i + 1;
                  const sql =
                    "INSERT INTO ot_steps (document_id, ot_version, step, user_id) VALUES (?, ?, ?, ?)";
                  db.run(
                    sql,
                    [documentId, step_ot_version, JSON.stringify(step), userID],
                    (err) => {
                      if (err) return reject(err);
                      resolve();
                    },
                  );
                });
              });

              Promise.all(promises)
                .then(() => {
                  new_ot_version += steps.length;
                  broadcast(wss, documentId, {
                    steps,
                    userID,
                    ot_version: new_ot_version,
                  });
                  ws.send(
                    JSON.stringify({
                      message: "success",
                      ot_version: new_ot_version,
                      documentId,
                    }),
                  );
                })
                .catch((err) => {
                  ws.send(JSON.stringify({ error: err.message }));
                });
            },
          );
        });
      } catch (e) {
        console.error("Failed to parse incoming message:", e);
        ws.send(JSON.stringify({ error: "Invalid message format" }));
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
    });
  });
}

module.exports = { setupCollaboration };
