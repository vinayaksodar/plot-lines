const WebSocket = require('ws');
const db = require('../database.js');

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
                    broadcast(wss, documentId, {
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
        ws.send(JSON.stringify({ error: "Invalid message format" }));
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
    });
  });
}

module.exports = { setupCollaboration };
