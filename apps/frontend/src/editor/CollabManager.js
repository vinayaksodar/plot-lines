import { collab, receiveTransaction, sendableSteps, getVersion, CollabState } from './collab.js';

export class CollabManager {
  constructor(initialState) {
    console.log("[CollabManager] constructor, initialState:", initialState);
    this.plugin = collab(initialState);
    this.state = {
        ...initialState,
        collab: this.plugin.state.init(),
    };
    this.state.collab.config = this.plugin.config;
    console.log("[CollabManager] constructor, state:", this.state);
  }

  applyTransaction(tr) {
    console.log("[CollabManager] applyTransaction, tr:", tr);
    this.state = {
      ...this.state,
      ...tr,
      collab: this.plugin.state.apply(tr, this.state.collab),
    };
    console.log("[CollabManager] applyTransaction, state:", this.state);
  }

  receive(steps, clientIDs) {
    console.log("[CollabManager] receive, steps:", steps, "clientIDs:", clientIDs);
    const newState = receiveTransaction(this.state, steps, clientIDs);
    this.state = newState;
    if (this.editor) {
        this.editor.model = newState.model;
        this.editor.view.model = newState.model; // Update the view's model
        this.editor.controller.model = newState.model; // Update the controller's model
    }
    console.log("[CollabManager] receive, newState:", newState);
    return newState;
  }

  sendableSteps() {
    console.log("[CollabManager] sendableSteps");
    return sendableSteps(this.state);
  }

  getVersion() {
    console.log("[CollabManager] getVersion");
    return getVersion(this.state);
  }

  clearUnconfirmed() {
    console.log("[CollabManager] clearUnconfirmed");
      const collabState = this.state.collab;
      this.state.collab = new CollabState(collabState.version, [], collabState.config);
  }
}
