import ToastService from "./ToastService.js";

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
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.reconnectTimer = null;
    this.reconnectToast = null;
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
    clearTimeout(this.reconnectTimer); // Clear any pending reconnect timer
    if (this.destroyed) return;
    console.log("[CollabService] Connecting to", this.serverUrl);
    this.socket = new WebSocket(this.serverUrl);

    this.socket.onopen = () => {
      console.log("[CollabService] WebSocket connection established");
      if (this.reconnectToast) {
        ToastService.hideToast(this.reconnectToast);
        this.reconnectToast = null;
      }
      if (this.reconnectAttempts > 0) {
        ToastService.showToast("Reconnected successfully!", "success");
      }
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000; // Reset delay on successful connection
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
      if (!this.destroyed) {
        this.reconnect();
      }
    };

    this.poll();
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const message = `Connection lost. Reconnecting... (Attempt ${this.reconnectAttempts})`;
      if (this.reconnectToast) {
        this.reconnectToast.textContent = message;
      } else {
        this.reconnectToast = ToastService.showToast(message, "error", {
          isPersistent: true,
        });
      }

      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
      this.reconnectDelay = Math.min(10000, this.reconnectDelay * 2); // Exponential backoff
    } else {
      const message =
        "Could not reconnect to the server. Please check your connection.";
      if (this.reconnectToast) {
        this.reconnectToast.textContent = message;
      } else {
        this.reconnectToast = ToastService.showToast(message, "error", {
          isPersistent: true,
        });
      }
      console.error("[CollabService] Max reconnection attempts reached.");
    }
  }

  poll() {
    if (this.destroyed) return;

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.pollTimeout = setTimeout(() => this.poll(), 1000);
      return;
    }

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
    clearTimeout(this.reconnectTimer); // Clear the reconnect timer
    if (this.socket) {
      this.socket.close();
    }
    console.log("[CollabService] Destroyed");
  }
}
