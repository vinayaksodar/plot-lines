export class CollabService {
  constructor({
    serverUrl,
    backendManager,
    persistenceManager,
    onReceive,
    onUserUpdate,
    documentId,
    getOtVersion,
    getSendableCommands,
    getCursorPos,
    getUserID,
    getUserName,
  }) {
    this.serverUrl = serverUrl;
    this.backendManager = backendManager;
    this.persistenceManager = persistenceManager;
    this.socket = null;
    this.pollTimeout = null;
    this.destroyed = false;
    this.onReceive = onReceive;
    this.onUserUpdate = onUserUpdate;
    this.documentId = documentId;
    this.getOtVersion = getOtVersion;
    this.getSendableCommands = getSendableCommands;
    this.getCursorPos = getCursorPos;
    this.getUserID = getUserID;
    this.getUserName = getUserName;
    console.log("[CollabService] Created for document", documentId);
  }

  connect() {
    if (this.destroyed) return;
    console.log("[CollabService] Connecting to", this.serverUrl);
    this.socket = new WebSocket(this.serverUrl);

    this.socket.onopen = () => {
      console.log("[CollabService] WebSocket connection established");
    };

    this.socket.onmessage = async (event) => {
      if (this.destroyed) return;
      const message = JSON.parse(event.data);
      console.log("[CollabService] Received message:", message);

      if (message.error === "OT Version mismatch") {
        clearTimeout(this.pollTimeout);
        const result = await this.backendManager.getSteps(
          this.documentId.replace("cloud-", ""),
          this.getOtVersion(),
        );

        if (result.error === "HISTORY_TOO_OLD") {
          // Fallback to snapshot because we are too far behind
          await this.persistenceManager.load(this.documentId);
        } else if (result.steps && result.steps.length > 0) {
          this.onReceive({ steps: result.steps, userID: result.userIDs });
        }
        this.poll(); // Restart polling after catching up
        return;
      }

      this.onReceive(message);
    };

    this.socket.onerror = (error) => {
      console.error("[CollabService] WebSocket error:", error);
    };

    this.socket.onclose = (event) => {
      console.log("[CollabService] WebSocket connection closed:", event);
    };

    this.poll();
  }

  poll() {
    if (this.destroyed) return;
    if (this.socket.readyState === WebSocket.OPEN) {
      const sendable = this.getSendableCommands();
      if (sendable && sendable.steps.length > 0) {
        // console.log("[CollabService] Sending local changes:", sendable);
        this.send({
          documentId: this.documentId.replace("cloud-", ""),
          ...sendable,
        });
      } else {
        const payload = {
          documentId: this.documentId.replace("cloud-", ""),
          ot_version: this.getOtVersion(),
          cursor: this.getCursorPos(),
          userID: this.getUserID(),
          userName: this.getUserName(),
        };
        console.log("[CollabService] Sending poll message:", payload);
        this.send(payload);
      }
    }
    this.pollTimeout = setTimeout(() => this.poll(), 1000);
  }

  send(data) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  destroy() {
    console.log("[CollabService] Destroying...");
    this.destroyed = true;
    clearTimeout(this.pollTimeout);
    if (this.socket) {
      this.socket.close();
    }
    console.log("[CollabService] Destroyed");
  }
}
