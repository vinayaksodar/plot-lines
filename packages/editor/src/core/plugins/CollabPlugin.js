import { Plugin } from "./Plugin.js";
import {
  InsertCharCommand,
  InsertNewLineCommand,
  DeleteCharCommand,
  DeleteTextCommand,
  InsertTextCommand,
  SetLineTypeCommand,
  ToggleInlineStyleCommand,
} from "../commands.js";
import { calculateFinalCursorPosition } from "../cursor.js";

export class CollabPlugin extends Plugin {
  constructor({
    serverUrl,
    backendManager,
    persistenceManager,
    userID,
    userMap,
    ot_version,
  }) {
    super();
    console.log(
      `[CollabPlugin] Constructor called with ot_version: ${ot_version}`,
    );
    this.serverUrl = serverUrl;
    this.backendManager = backendManager;
    this.persistenceManager = persistenceManager;
    this.socket = null;
    this.userID = userID;
    this.pollTimeout = null;
    this.remoteCursors = new Map();
    this.userMap = userMap || new Map();
    this.isReady = false; // Don't send steps until initial snapshot is created
    this.destroyed = false;
    this.ot_version = ot_version || 0;
    console.log(
      `[CollabPlugin] Initialized with ot_version: ${this.ot_version}`,
    );
    this.unconfirmed = [];
  }

  setReady() {
    this.isReady = true;
  }

  getUserName(userID) {
    return this.userMap.get(userID) || `User ${userID}`;
  }

  updateUserMap(users) {
    this.userMap.clear();
    for (const user of users) {
      this.userMap.set(user.id, user.email);
    }
  }

  onRegister(editor) {
    this.editor = editor;
    this.model = editor.getModel();
    this.editor.collab = this;
  }

  connect() {
    if (this.destroyed) return;
    this.socket = new WebSocket(this.serverUrl);

    this.socket.onopen = () => {
      console.log("WebSocket connection established");
    };

    this.socket.onmessage = async (event) => {
      if (this.destroyed) return;
      const message = JSON.parse(event.data);
      console.log("Received message:", message);

      if (message.error === "Version mismatch") {
        const result = await this.backendManager.getSteps(
          message.documentId.replace("cloud-", ""),
          this.getVersion(),
        );

        if (result.error === "HISTORY_TOO_OLD") {
          // Fallback to snapshot because we are too far behind
          const unconfirmedCommands = this.unconfirmed;
          await this.persistenceManager.load(this.editor.documentId);
          // After loading, the model and its ot_version are updated.
          // We need to reset the collab state and re-apply unconfirmed changes.
          this.unconfirmed = unconfirmedCommands;
        } else if (result.steps && result.steps.length > 0) {
          this.receive(result.steps, result.userIDs);
        }
        return;
      }

      if (message.steps) {
        const userIDs = message.steps.map(() => message.userID);
        this.receive(message.steps, userIDs);
        if (message.userID !== this.userID) {
          this.editor.getView().render();
        }
      }

      if (message.cursor) {
        if (message.userID !== this.userID) {
          this.remoteCursors.set(message.userID, message.cursor);
          this.editor.getView().render();
        }
      }
    };

    this.poll();
  }

  poll() {
    if (this.destroyed) return;
    if (this.socket.readyState === WebSocket.OPEN && this.editor.documentId) {
      this._combineUnconfirmedSteps();

      const sendable = this.sendableCommands();
      if (sendable && sendable.steps.length > 0) {
        console.log("Sending local changes:", sendable);
        this.socket.send(
          JSON.stringify({
            documentId: this.editor.documentId.replace("cloud-", ""),
            ...sendable,
          }),
        );
      } else {
        const payload = {
          documentId: this.editor.documentId.replace("cloud-", ""),
          ot_version: this.getVersion(),
          cursor: this.model.getCursorPos(),
          userID: this.userID,
        };
        console.log("[CollabPlugin] Sending poll message:", payload);
        this.socket.send(JSON.stringify(payload));
      }
    }
    this.pollTimeout = setTimeout(() => this.poll(), 1000);
  }

  _combineUnconfirmedSteps() {
    if (this.unconfirmed.length < 2) {
      return;
    }

    this.unconfirmed = this._combineInsertCharsInUnconfirmed(this.unconfirmed);
    this.unconfirmed = this._combineDeleteCharsInUnconfirmed(this.unconfirmed);
  }

  _combineInsertCharsInUnconfirmed(unconfirmed) {
    if (unconfirmed.length < 2) {
      return unconfirmed;
    }

    const newUnconfirmed = [];
    let i = 0;
    while (i < unconfirmed.length) {
      const currentCommand = unconfirmed[i];

      if (
        currentCommand instanceof InsertCharCommand ||
        currentCommand instanceof InsertTextCommand
      ) {
        let combinedText =
          currentCommand instanceof InsertCharCommand
            ? currentCommand.char
            : currentCommand.text;
        let startPos = currentCommand.pos;
        let lastIndex = i;

        for (let j = i + 1; j < unconfirmed.length; j++) {
          const nextCommand = unconfirmed[j];

          if (
            (nextCommand instanceof InsertCharCommand ||
              nextCommand instanceof InsertTextCommand) &&
            nextCommand.pos.line === startPos.line &&
            nextCommand.pos.ch === startPos.ch + combinedText.length
          ) {
            const nextText =
              nextCommand instanceof InsertCharCommand
                ? nextCommand.char
                : nextCommand.text;
            combinedText += nextText;
            lastIndex = j;
          } else {
            break; // Sequence broken
          }
        }

        if (lastIndex > i) {
          // Combination happened
          const combinedCommand = new InsertTextCommand(combinedText, startPos);
          newUnconfirmed.push(combinedCommand);
          i = lastIndex + 1;
        } else {
          // No combination
          newUnconfirmed.push(unconfirmed[i]);
          i++;
        }
      } else {
        // Not an insert command
        newUnconfirmed.push(unconfirmed[i]);
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
      const currentCommand = unconfirmed[i];

      // Combine backward deletions
      if (
        currentCommand instanceof DeleteCharCommand &&
        currentCommand.pos.ch > 0
      ) {
        let rangeStart = {
          line: currentCommand.pos.line,
          ch: currentCommand.pos.ch - 1,
        };
        let rangeEnd = { ...currentCommand.pos };
        let lastIndex = i;

        for (let j = i + 1; j < unconfirmed.length; j++) {
          const nextCommand = unconfirmed[j];

          if (
            nextCommand instanceof DeleteCharCommand &&
            nextCommand.pos.line === rangeStart.line &&
            nextCommand.pos.ch === rangeStart.ch
          ) {
            rangeStart.ch--;
            lastIndex = j;
          } else {
            break; // Sequence broken
          }
        }

        if (lastIndex > i) {
          // Combination happened
          const combinedCommand = new DeleteTextCommand({
            start: rangeStart,
            end: rangeEnd,
          });
          newUnconfirmed.push(combinedCommand);
          i = lastIndex + 1;
        } else {
          // No combination
          newUnconfirmed.push(unconfirmed[i]);
          i++;
        }
      } else {
        // Not a backward delete command
        newUnconfirmed.push(unconfirmed[i]);
        i++;
      }
    }
    return newUnconfirmed;
  }

  onEvent(eventName, data) {
    if (eventName === "command") {
      this.unconfirmed.push(data);
    }
  }

  receive(commands, userIDs) {
    console.log(
      `[CollabPlugin] receive: current version: ${this.ot_version}, receiving ${commands.length} commands.`,
    );
    this.ot_version += commands.length;
    console.log(`[CollabPlugin] receive: new version: ${this.ot_version}`);

    // Filter out our own confirmed steps
    let ours = 0;
    while (ours < userIDs.length && userIDs[ours] == this.userID) ++ours;
    this.unconfirmed = this.unconfirmed.slice(ours);
    commands = ours ? commands.slice(ours) : commands;

    if (!commands.length) {
      return;
    }

    const model = this.editor.getModel();
    const originalCursor = model.getCursorPos();
    const remoteCommands = commands.map((command) => commandFromJSON(command));
    const unconfirmedCommands = this.unconfirmed;

    // 1. Apply inverse of unconfirmed commands
    const invertedUnconfirmed = unconfirmedCommands
      .map((cmd) => cmd.invert())
      .reverse();
    this.editor.executeCommandsBypassUndo(invertedUnconfirmed);

    // 2. Apply remote commands
    this.editor.executeCommandsBypassUndo(remoteCommands);

    // 3. Rebase and apply unconfirmed commands
    const rebaser = new Rebaser(remoteCommands);
    const rebasedUnconfirmed = rebaser.rebaseCommands(unconfirmedCommands);
    this.editor.executeCommandsBypassUndo(rebasedUnconfirmed);

    // 4. Rebase undo/redo stacks
    rebaser.rebaseUndoStack(this.editor.undoManager);

    // 5. Rebase cursor
    const newCursor = calculateFinalCursorPosition(originalCursor, [
      ...remoteCommands,
      ...rebasedUnconfirmed,
    ]);
    model.updateCursor(newCursor);

    this.unconfirmed = rebasedUnconfirmed;
  }

  sendableCommands() {
    if (this.unconfirmed.length == 0) return null;
    const payload = {
      ot_version: this.ot_version,
      steps: this.unconfirmed.map((s) => s.toJSON()),
      userID: this.userID,
    };
    console.log("[CollabPlugin] sendableCommands:", payload);
    return payload;
  }

  getVersion() {
    return this.ot_version;
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.pollTimeout);
    if (this.socket) {
      this.socket.close();
    }
    this.remoteCursors.clear();
    console.log("CollabPlugin destroyed");
  }
}

function commandFromJSON(json) {
  if (!json || !json.type) return null;
  switch (json.type) {
    case "InsertCharCommand":
      return new InsertCharCommand(json.pos, json.char);
    case "DeleteCharCommand":
      return new DeleteCharCommand(json.pos);
    case "DeleteTextCommand":
      return new DeleteTextCommand(json.range);
    case "InsertNewLineCommand":
      return new InsertNewLineCommand(json.pos);
    case "InsertTextCommand":
      return new InsertTextCommand(json.text, json.pos);
    case "SetLineTypeCommand":
      return new SetLineTypeCommand(json.newType, json.pos);
    case "ToggleInlineStyleCommand":
      return new ToggleInlineStyleCommand(json.style, json.range);
    default:
      console.error("Unknown step type:", json.type);
      return null;
  }
}

class Rebaser {
  constructor(commands) {
    this.commands = commands || [];
  }

  rebaseCommands(commands) {
    let rebasedCommands = [...commands];
    for (const remoteCmd of this.commands) {
      rebasedCommands = rebasedCommands
        .map((localCmd) => this.rebase(localCmd, remoteCmd))
        .filter(Boolean);
    }
    return rebasedCommands;
  }

  rebase(localCmd, remoteCmd) {
    // Text vs Text
    if (
      localCmd instanceof InsertCharCommand &&
      remoteCmd instanceof InsertCharCommand
    ) {
      if (
        localCmd.pos.line === remoteCmd.pos.line &&
        localCmd.pos.ch >= remoteCmd.pos.ch
      ) {
        return new InsertCharCommand(
          { line: localCmd.pos.line, ch: localCmd.pos.ch + 1 },
          localCmd.char,
        );
      }
    } else if (
      localCmd instanceof InsertCharCommand &&
      remoteCmd instanceof DeleteCharCommand
    ) {
      if (
        localCmd.pos.line === remoteCmd.pos.line &&
        localCmd.pos.ch > remoteCmd.pos.ch
      ) {
        return new InsertCharCommand(
          { line: localCmd.pos.line, ch: localCmd.pos.ch - 1 },
          localCmd.char,
        );
      }
    } else if (
      localCmd instanceof DeleteCharCommand &&
      remoteCmd instanceof InsertCharCommand
    ) {
      if (
        localCmd.pos.line === remoteCmd.pos.line &&
        localCmd.pos.ch >= remoteCmd.pos.ch
      ) {
        return new DeleteCharCommand({
          line: localCmd.pos.line,
          ch: localCmd.pos.ch + 1,
        });
      }
    } else if (
      localCmd instanceof DeleteCharCommand &&
      remoteCmd instanceof DeleteCharCommand
    ) {
      if (
        localCmd.pos.line === remoteCmd.pos.line &&
        localCmd.pos.ch > remoteCmd.pos.ch
      ) {
        return new DeleteCharCommand({
          line: localCmd.pos.line,
          ch: localCmd.pos.ch - 1,
        });
      } else if (
        localCmd.pos.line === remoteCmd.pos.line &&
        localCmd.pos.ch === remoteCmd.pos.ch
      ) {
        return null; // The exact same character was deleted.
      }
    } else if (
      localCmd instanceof InsertTextCommand &&
      remoteCmd instanceof InsertCharCommand
    ) {
      if (
        localCmd.pos.line === remoteCmd.pos.line &&
        localCmd.pos.ch >= remoteCmd.pos.ch
      ) {
        return new InsertTextCommand(localCmd.text, {
          line: localCmd.pos.line,
          ch: localCmd.pos.ch + 1,
        });
      }
    } else if (
      localCmd instanceof InsertTextCommand &&
      remoteCmd instanceof DeleteCharCommand
    ) {
      if (
        localCmd.pos.line === remoteCmd.pos.line &&
        localCmd.pos.ch > remoteCmd.pos.ch
      ) {
        return new InsertTextCommand(localCmd.text, {
          line: localCmd.pos.line,
          ch: localCmd.pos.ch - 1,
        });
      }
    } else if (
      localCmd instanceof DeleteTextCommand &&
      remoteCmd instanceof InsertCharCommand
    ) {
      const { start, end } = localCmd.range;
      if (remoteCmd.pos.line >= start.line && remoteCmd.pos.line <= end.line) {
        // Complex case: remote change is within the deleted range. For simplicity, we can drop the local command.
        return null;
      }
    } else if (
      localCmd instanceof InsertNewLineCommand &&
      remoteCmd instanceof InsertCharCommand
    ) {
      if (
        localCmd.pos.line === remoteCmd.pos.line &&
        localCmd.pos.ch >= remoteCmd.pos.ch
      ) {
        return new InsertNewLineCommand({
          line: localCmd.pos.line,
          ch: localCmd.pos.ch + 1,
        });
      }
    }

    // LineType vs Text
    if (
      localCmd instanceof SetLineTypeCommand &&
      (remoteCmd instanceof InsertNewLineCommand ||
        (remoteCmd instanceof InsertTextCommand &&
          remoteCmd.text &&
          remoteCmd.text.includes("\n")))
    ) {
      if (localCmd.lineNumber >= remoteCmd.pos.line) {
        const lineCount =
          remoteCmd instanceof InsertTextCommand && remoteCmd.text
            ? remoteCmd.text.split("\n").length - 1
            : 1;
        return new SetLineTypeCommand(
          localCmd.newType,
          localCmd.lineNumber + lineCount,
        );
      }
    } else if (
      localCmd instanceof SetLineTypeCommand &&
      remoteCmd instanceof DeleteCharCommand &&
      remoteCmd.char === "\n"
    ) {
      if (localCmd.lineNumber > remoteCmd.pos.line) {
        return new SetLineTypeCommand(
          localCmd.newType,
          localCmd.lineNumber - 1,
        );
      } else if (localCmd.lineNumber === remoteCmd.pos.line) {
        return null; // Line was deleted
      }
    }

    // InlineStyle vs Text
    if (
      localCmd instanceof ToggleInlineStyleCommand &&
      remoteCmd instanceof InsertCharCommand
    ) {
      // This is complex. For now, we'll just assume the local command is still valid.
      // A more robust solution would be to adjust the range.
    }

    return localCmd; // Default to no-op
  }

  rebaseUndoStack(undoManager) {
    const rebaseStack = (stack) => {
      let newStack = [];
      for (const command of stack) {
        const rebased = this.rebaseCommands([command]);
        if (rebased.length > 0) {
          newStack.push(rebased[0]);
        }
      }
      return newStack;
    };

    undoManager.undoStack = rebaseStack(undoManager.undoStack);
    undoManager.redoStack = rebaseStack(undoManager.redoStack);
  }
}
