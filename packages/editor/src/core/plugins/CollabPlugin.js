import { Plugin } from "./Plugin.js";
import { collab, receiveTransaction, sendableSteps, getVersion, CollabState } from "../collab.js";

export class CollabPlugin extends Plugin {
  constructor({ serverUrl }) {
    super();
    this.serverUrl = serverUrl;
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

    this.connect();
  }

  connect() {
    this.socket = new WebSocket(this.serverUrl);

    this.socket.onopen = () => {
      console.log('WebSocket connection established');
    };

    this.socket.onmessage = event => {
      const message = JSON.parse(event.data);
      console.log("Received message:", message);
      const clientIDs = message.steps.map(() => message.clientID);
      this.receive(message.steps, clientIDs);
      if (message.clientID !== this.collabState.collab.config.clientID) {
          this.editor.getView().render();
      }
    };

    this.poll();
  }

  poll() {
    if (this.socket.readyState === WebSocket.OPEN) {
      const sendable = this.sendableSteps();
      if (sendable && sendable.steps.length > 0) {
        console.log("Sending local changes:", sendable);
        this.socket.send(JSON.stringify(sendable));
      }
    }
    setTimeout(() => this.poll(), 1000);
  }

  onEvent(eventName, data) {
    if (eventName === 'command') {
      const tr = {
        steps: [data],
        docChanged: true,
        getMeta: (key) => key === 'collab' ? null : undefined
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
