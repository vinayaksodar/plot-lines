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
        const { documentId, ot_version, steps, userID } = JSON.parse(message);

        db.get(
          "SELECT MAX(version) as latest_version FROM ot_steps WHERE document_id = ?",
          [documentId],
          (err, row) => {
            if (err) {
              return ws.send(JSON.stringify({ error: err.message }));
            }
            const latest_ot_version = row ? row.latest_version || 0 : 0;
            if (latest_ot_version !== ot_version) {
              return ws.send(
                JSON.stringify({ error: "Version mismatch", documentId }),
              );
            }

            if (!Array.isArray(steps)) {
              return;
            }

            let newVersion = version;
            const promises = steps.map((step, i) => {
              return new Promise((resolve, reject) => {
                const stepVersion = version + i + 1;
                const sql =
                  "INSERT INTO ot_steps (document_id, version, step, user_id) VALUES (?, ?, ?, ?)";
                db.run(
                  sql,
                  [documentId, stepVersion, JSON.stringify(step), userID],
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
                broadcast(wss, documentId, {
                  steps,
                  userID,
                  version: newVersion,
                });
                ws.send(
                  JSON.stringify({
                    message: "success",
                    version: newVersion,
                    documentId,
                  }),
                );
              })
              .catch((err) => {
                ws.send(JSON.stringify({ error: err.message }));
              });
          },
        );
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
