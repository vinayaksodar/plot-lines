import { Plugin } from "./Plugin.js";
import {
  collab,
  receiveTransaction,
  sendableSteps,
  getVersion,
  CollabState,
  Rebaseable,
} from "../collab.js";
import { InsertCharCommand, InsertTextCommand, DeleteCharCommand, DeleteSelectionCommand } from "../commands.js";

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
      this._combineUnconfirmedSteps();

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

  _combineUnconfirmedSteps() {
    let unconfirmed = this.collabState.collab.unconfirmed;
    if (unconfirmed.length < 2) {
      return;
    }

    unconfirmed = this._combineInsertCharsInUnconfirmed(unconfirmed);
    unconfirmed = this._combineDeleteCharsInUnconfirmed(unconfirmed);

    this.collabState.collab.unconfirmed = unconfirmed;
  }

  _combineInsertCharsInUnconfirmed(unconfirmed) {
    if (unconfirmed.length < 2) {
        return unconfirmed;
    }

    const newUnconfirmed = [];
    let i = 0;
    while (i < unconfirmed.length) {
        const currentRebaseable = unconfirmed[i];
        const currentStep = currentRebaseable.step;

        if ((currentStep instanceof InsertCharCommand || currentStep instanceof InsertTextCommand)) {
            let combinedText = (currentStep instanceof InsertCharCommand) ? currentStep.char : currentStep.text;
            let startPos = currentStep.pos;
            let origin = currentRebaseable.origin;
            let lastIndex = i;

            for (let j = i + 1; j < unconfirmed.length; j++) {
                const nextRebaseable = unconfirmed[j];
                const nextStep = nextRebaseable.step;

                if ((nextStep instanceof InsertCharCommand || nextStep instanceof InsertTextCommand) &&
                    nextStep.pos.line === startPos.line &&
                    nextStep.pos.ch === startPos.ch + combinedText.length) {

                    const nextText = (nextStep instanceof InsertCharCommand) ? nextStep.char : nextStep.text;
                    combinedText += nextText;
                    lastIndex = j;
                } else {
                    break; // Sequence broken
                }
            }

            if (lastIndex > i) {
                // Combination happened
                const combinedCommand = new InsertTextCommand(combinedText, startPos);
                const inverted = combinedCommand.invert();
                newUnconfirmed.push(new Rebaseable(combinedCommand, inverted, origin));
                i = lastIndex + 1;
            } else {
                // No combination
                newUnconfirmed.push(currentRebaseable);
                i++;
            }
        } else {
            // Not an insert command
            newUnconfirmed.push(currentRebaseable);
            i++;
        }
    }
    return newUnconfirmed;
  }

  _combineDeleteCharsInUnconfirmed(unconfirmed) {
    if (unconfirmed.length < 2) {
        return unconfirmed;
    }

    const newUnconfirmed = [];
    let i = 0;
    while (i < unconfirmed.length) {
        const currentRebaseable = unconfirmed[i];
        const currentStep = currentRebaseable.step;

        // Combine backward deletions
        if (currentStep instanceof DeleteCharCommand && currentStep.pos.ch > 0) {
            let selectionStart = { line: currentStep.pos.line, ch: currentStep.pos.ch - 1 };
            let selectionEnd = { ...currentStep.pos };
            let origin = currentRebaseable.origin;
            let lastIndex = i;

            for (let j = i + 1; j < unconfirmed.length; j++) {
                const nextRebaseable = unconfirmed[j];
                const nextStep = nextRebaseable.step;

                if (nextStep instanceof DeleteCharCommand &&
                    nextStep.pos.line === selectionStart.line &&
                    nextStep.pos.ch === selectionStart.ch) {
                    
                    selectionStart.ch--;
                    lastIndex = j;
                } else {
                    break; // Sequence broken
                }
            }

            if (lastIndex > i) {
                // Combination happened
                const text = this.editor.getModel().getTextInRange(selectionStart, selectionEnd);
                const combinedCommand = new DeleteSelectionCommand({ start: selectionStart, end: selectionEnd });
                const inverted = new InsertTextCommand(text, selectionStart);
                newUnconfirmed.push(new Rebaseable(combinedCommand, inverted, origin));
                i = lastIndex + 1;
            } else {
                // No combination
                newUnconfirmed.push(currentRebaseable);
                i++;
            }
        } else {
            // Not a backward delete command
            newUnconfirmed.push(currentRebaseable);
            i++;
        }
    }
    return newUnconfirmed;
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
