import { Plugin } from "./Plugin.js";
import {
  collab,
  receiveTransaction,
  sendableSteps,
  getVersion,
  CollabState,
} from "../collab.js";

export class CollabPlugin extends Plugin {
  constructor({ serverUrl, backendManager, persistenceManager }) {
    super();
    this.serverUrl = serverUrl;
    this.backendManager = backendManager;
    this.persistenceManager = persistenceManager;
    this.socket = null;
    this.collabState = null;
  }

  onRegister(editor) {
    this.editor = editor;
    this.model = editor.getModel();

    const initialState = {
      model: this.model,
      version: 0,
    };
    this.plugin = collab(initialState);
    this.collabState = {
      ...initialState,
      collab: this.plugin.state.init(),
    };
    this.collabState.collab.config = this.plugin.config;
    this.editor.collab = this;

    this.connect();
  }

  connect() {
    this.socket = new WebSocket(this.serverUrl);

    this.socket.onopen = () => {
      console.log("WebSocket connection established");
    };

    this.socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      console.log("Received message:", message);

      if (message.error === "Version mismatch") {
        const result = await this.backendManager.getSteps(
          message.documentId,
          this.getVersion(),
        );
        if (result.steps && result.steps.length > 0) {
          this.receive(result.steps, result.clientIDs);
        } else {
          // Fallback to snapshot
          const unconfirmed = this.sendableSteps()?.steps || [];
          await this.persistenceManager.load(this.editor.documentId);
          // After loading, the model and its version are updated.
          // We need to reset the collab state and re-apply unconfirmed changes.
          this.collabState = {
            ...this.collabState,
            version: this.editor.getModel().version,
            unconfirmed: [],
          };
          if (unconfirmed.length > 0) {
            for (const step of unconfirmed) {
              this.applyTransaction({
                steps: [step],
                docChanged: true,
                getMeta: (key) => (key === "collab" ? null : undefined),
              });
            }
          }
        }
        return;
      }

      if (message.steps) {
        const clientIDs = message.steps.map(() => message.clientID);
        this.receive(message.steps, clientIDs);
        if (message.clientID !== this.collabState.collab.config.clientID) {
          this.editor.getView().render();
        }
      }
    };

    this.poll();
  }

  poll() {
    if (this.socket.readyState === WebSocket.OPEN && this.editor.documentId) {
      const sendable = this.sendableSteps();
      if (sendable && sendable.steps.length > 0) {
        console.log("Sending local changes:", sendable);
        this.socket.send(
          JSON.stringify({
            documentId: this.editor.documentId.replace("cloud-", ""),
            ...sendable,
          }),
        );
      }
    }
    setTimeout(() => this.poll(), 1000);
  }

  onEvent(eventName, data) {
    if (eventName === "command") {
      const tr = {
        steps: [data],
        docChanged: true,
        getMeta: (key) => (key === "collab" ? null : undefined),
      };
      this.applyTransaction(tr);
    }
  }

  applyTransaction(tr) {
    this.collabState = {
      ...this.collabState,
      ...tr,
      collab: this.plugin.state.apply(tr, this.collabState.collab),
    };
  }

  receive(steps, clientIDs) {
    const newState = receiveTransaction(this.collabState, steps, clientIDs);
    this.collabState = newState;
    this.editor.model = newState.model;
    this.editor.view.model = newState.model;
    this.editor.controller.model = newState.model;
  }

  sendableSteps() {
    return sendableSteps(this.collabState);
  }

  getVersion() {
    return getVersion(this.collabState);
  }
}
