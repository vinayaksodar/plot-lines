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
  constructor({ userID, userMap, ot_version }) {
    super();
    console.log(
      `[CollabPlugin] Constructor called with ot_version: ${ot_version}`,
    );
    this.userID = userID;
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

  onRegister(controller) {
    this.controller = controller;
    this.model = controller.model;
  }

  onEvent(eventName, data) {
    if (eventName === "command") {
      this.unconfirmed.push(data);
    }
  }

  receive(message, ignoreOwnCommands = true) {
    if (this.destroyed) return;

    if (message.steps) {
      const userIDs = message.steps.map(() => message.userID);
      this._receiveSteps(message.steps, userIDs, ignoreOwnCommands);
      if (message.userID !== this.userID) {
        this.controller.view.render();
      }
    }

    if (message.cursor) {
      if (message.userID !== this.userID) {
        this.remoteCursors.set(message.userID, {
          cursor: message.cursor,
          userName: this.getUserName(message.userID),
        });
        this.controller.updateRemoteCursors(this.remoteCursors);
      }
    }
  }

  _receiveSteps(commands, userIDs, ignoreOwnCommands = true) {
    console.log(
      `[CollabPlugin] receive: current version: ${this.ot_version}, receiving ${commands.length} commands.`,
    );
    this.ot_version += commands.length;
    console.log(`[CollabPlugin] receive: new version: ${this.ot_version}`);

    // Filter out our own confirmed steps
    if (ignoreOwnCommands) {
      let ours = 0;
      while (ours < userIDs.length && userIDs[ours] == this.userID) ++ours;
      this.unconfirmed = this.unconfirmed.slice(ours);
      commands = ours ? commands.slice(ours) : commands;
    }

    if (!commands.length) {
      return;
    }

    const model = this.model;
    const originalCursor = model.getCursorPos();
    const remoteCommands = commands.map((command) => commandFromJSON(command));
    const unconfirmedCommands = this.unconfirmed;

    // 1. Apply inverse of unconfirmed commands
    const invertedUnconfirmed = unconfirmedCommands
      .map((cmd) => cmd.invert())
      .reverse();
    this.controller.executeCommandsBypassUndo(invertedUnconfirmed);

    // 2. Apply remote commands
    this.controller.executeCommandsBypassUndo(remoteCommands);

    // 3. Rebase and apply unconfirmed commands
    const rebaser = new Rebaser(remoteCommands);
    const rebasedUnconfirmed = rebaser.rebaseCommands(unconfirmedCommands);
    this.controller.executeCommandsBypassUndo(rebasedUnconfirmed);

    // 4. Rebase undo/redo stacks
    rebaser._rebaseUndoStack(
      this.controller.undoManager,
      rebaser,
      remoteCommands,
    );

    this.unconfirmed = rebasedUnconfirmed;
  }

  sendableCommands() {
    if (this.unconfirmed.length == 0) return null;
    this._combineUnconfirmedSteps();
    const payload = {
      ot_version: this.ot_version,
      steps: this.unconfirmed.map((s) => s.toJSON()),
      userID: this.userID,
    };
    console.log("[CollabPlugin] sendableCommands:", payload);
    return payload;
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
        (currentCommand instanceof InsertTextCommand &&
          currentCommand.richText.length === 1)
      ) {
        let combinedText = getCommandText(currentCommand);
        let startPos = currentCommand.pos;
        let lastIndex = i;

        for (let j = i + 1; j < unconfirmed.length; j++) {
          const nextCommand = unconfirmed[j];

          if (
            (nextCommand instanceof InsertCharCommand ||
              (nextCommand instanceof InsertTextCommand &&
                nextCommand.richText.length === 1)) &&
            nextCommand.pos.line === startPos.line &&
            nextCommand.pos.ch === startPos.ch + combinedText.length
          ) {
            const nextText = getCommandText(nextCommand);
            combinedText += nextText;
            lastIndex = j;
          } else {
            break; // Sequence broken
          }
        }

        if (lastIndex > i) {
          // Combination happened
          const line = this.controller.model.lines[startPos.line];
          if (!line) {
            // This line was deleted by a subsequent command in the unconfirmed batch.
            // It's too complex to determine the correct line type, so we abort the combination.
            newUnconfirmed.push(...unconfirmed.slice(i, lastIndex + 1));
            i = lastIndex + 1;
            continue;
          }
          const lineType = line.type;
          const richText = [
            {
              type: lineType,
              segments: [
                {
                  text: combinedText,
                  bold: false,
                  italic: false,
                  underline: false,
                },
              ],
            },
          ];
          const combinedCommand = new InsertTextCommand(richText, startPos);
          newUnconfirmed.push(combinedCommand);
          i = lastIndex + 1;
        } else {
          // No combination
          newUnconfirmed.push(unconfirmed[i]);
          i++;
        }
      } else {
        // Not a combinable insert command
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

  getVersion() {
    return this.ot_version;
  }

  destroy() {
    this.destroyed = true;
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
      return new InsertTextCommand(json.richText, json.pos);
    case "SetLineTypeCommand":
      return new SetLineTypeCommand(json.newType, json.pos);
    case "ToggleInlineStyleCommand":
      return new ToggleInlineStyleCommand(json.style, json.range);
    default:
      console.error("Unknown step type:", json.type);
      return null;
  }
}

function getCommandText(cmd) {
  if (cmd instanceof InsertCharCommand) {
    return cmd.char;
  }
  if (cmd instanceof InsertTextCommand) {
    return cmd.richText
      .map((line) => line.segments.map((s) => s.text).join(""))
      .join("\n");
  }
  return "";
}

class Rebaser {
  constructor(commands) {
    this.commands = commands || [];
  }

  rebaseCommands(localCommands) {
    let rebased = [...localCommands];
    // Sequentially rebase the local commands against each remote command.
    for (const remote of this.commands) {
      rebased = this._transformByCommands(rebased, remote);
    }
    return rebased;
  }

  _transformByCommands(localCommands, transformBy) {
    // If transformBy is an array, apply them sequentially.
    if (Array.isArray(transformBy)) {
      let res = [...localCommands];
      for (const t of transformBy) {
        res = this._transformByCommands(res, t);
      }
      return res;
    }

    const transformed = [];
    for (let i = 0; i < localCommands.length; i++) {
      const local = localCommands[i];
      const rebased = this.rebase(local, transformBy);

      if (Array.isArray(rebased)) {
        transformed.push(...rebased);
        continue;
      } else if (rebased) {
        transformed.push(rebased);
        continue;
      }

      // The command `local` was dropped by `transformBy` (rebased === null).
      // The rest of the commands in the sequence need to be adjusted to account for this.

      // Normalize invert() result into an array, as it might return one or many commands.
      const invertedDroppedRaw = local.invert();
      const invertedDropped = Array.isArray(invertedDroppedRaw)
        ? invertedDroppedRaw
        : [invertedDroppedRaw];

      const remaining = localCommands.slice(i + 1);

      // 1. First, transform the remaining commands over the inverse of the one that was just dropped.
      // This "undoes" the dropped command's effect on the rest of the sequence.
      const adjustedRemaining = this._transformByCommands(
        remaining,
        invertedDropped,
      );

      // 2. Then, transform that result over the original `transformBy` command.
      // This applies the remote command's effect to the adjusted sequence.
      const finalRemaining = this._transformByCommands(
        adjustedRemaining,
        transformBy,
      );

      // The final result is the commands that were successful so far, plus the fully transformed remaining commands.
      return transformed.concat(finalRemaining);
    }

    // If the loop completes without any commands being dropped.
    return transformed;
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
        return new InsertTextCommand(localCmd.richText, {
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
        return new InsertTextCommand(localCmd.richText, {
          line: localCmd.pos.line,
          ch: localCmd.pos.ch - 1,
        });
      }
    } else if (
      (localCmd instanceof InsertCharCommand ||
        localCmd instanceof InsertTextCommand) &&
      remoteCmd instanceof DeleteTextCommand
    ) {
      const { start: remoteStart, end: remoteEnd } = remoteCmd.range;
      const pos = localCmd.pos;
      const text = getCommandText(localCmd);

      const textLines = text ? text.split("\n") : [""];
      const localStart = pos;
      const localEnd = {
        line: pos.line + textLines.length - 1,
        ch:
          (textLines.length > 1 ? 0 : pos.ch) +
          textLines[textLines.length - 1].length,
      };

      const cmp = (p1, p2) => {
        if (p1.line < p2.line) return -1;
        if (p1.line > p2.line) return 1;
        if (p1.ch < p2.ch) return -1;
        if (p1.ch > p2.ch) return 1;
        return 0;
      };

      // If the ranges intersect, drop the local command.
      if (cmp(localStart, remoteEnd) < 0 && cmp(remoteStart, localEnd) < 0) {
        return null;
      }

      // If remote deletion is completely before the local insertion, adjust position.
      if (cmp(remoteEnd, localStart) <= 0) {
        const newPos = calculateFinalCursorPosition(pos, [remoteCmd]);
        if (localCmd instanceof InsertCharCommand) {
          return new InsertCharCommand(newPos, localCmd.char);
        } else {
          return new InsertTextCommand(localCmd.richText, newPos);
        }
      }

      return localCmd;
    } else if (
      localCmd instanceof DeleteTextCommand &&
      remoteCmd instanceof InsertCharCommand
    ) {
      const { start, end } = localCmd.range;
      const pos = remoteCmd.pos;

      const cmp = (p1, p2) => {
        if (p1.line < p2.line) return -1;
        if (p1.line > p2.line) return 1;
        if (p1.ch < p2.ch) return -1;
        if (p1.ch > p2.ch) return 1;
        return 0;
      };

      // Insertion is inside the deleted range, split the deletion
      if (cmp(pos, start) > 0 && cmp(pos, end) < 0) {
        const delete1 = new DeleteTextCommand({ start: start, end: pos });

        const newStart2 = calculateFinalCursorPosition(pos, [remoteCmd]);
        const newEnd2 = calculateFinalCursorPosition(end, [remoteCmd]);
        const delete2 = new DeleteTextCommand({ start: newStart2, end: newEnd2 });

        return [delete1, delete2];
      }

      // Insertion is not inside, just transform the range
      const newStart = calculateFinalCursorPosition(start, [remoteCmd]);
      const newEnd = calculateFinalCursorPosition(end, [remoteCmd]);
      return new DeleteTextCommand({ start: newStart, end: newEnd });
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
          getCommandText(remoteCmd) &&
          getCommandText(remoteCmd).includes("\n")))
    ) {
      if (localCmd.lineNumber >= remoteCmd.pos.line) {
        const lineCount =
          remoteCmd instanceof InsertTextCommand
            ? getCommandText(remoteCmd).split("\n").length - 1
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

  _rebaseUndoStack(undoManager, rebaser, remoteCommands) {
    const rebaseStack = (stack) => {
      const newStack = [];
      for (const batch of stack) {
        const newBatch = [];
        for (const item of batch) {
          const rebasedCommandArray = rebaser.rebaseCommands([item.command]);

          if (rebasedCommandArray.length > 0) {
            let lastState = this._rebaseState(item.preState, remoteCommands);

            for (let i = 0; i < rebasedCommandArray.length; i++) {
              const command = rebasedCommandArray[i];
              const isLast = i === rebasedCommandArray.length - 1;

              const preState = lastState;
              const postState = isLast
                ? this._rebaseState(item.postState, remoteCommands)
                : this._rebaseStateOnCommand(preState, command);

              newBatch.push({ command, preState, postState });
              lastState = postState;
            }
          }
        }
        if (newBatch.length > 0) {
          newStack.push(newBatch);
        }
      }
      return newStack;
    };

    undoManager.undoStack = rebaseStack(undoManager.undoStack);
    undoManager.redoStack = rebaseStack(undoManager.redoStack);
  }

  _rebaseStateOnCommand(state, command) {
    if (!state) return null;
    const newCursor = calculateFinalCursorPosition(state.cursor, [command]);
    // Selections are generally not preserved through this kind of complex transform.
    return { cursor: newCursor, selection: null };
  }

  _rebaseState(state, commands) {
    if (!state) return null;

    const newCursor = calculateFinalCursorPosition(state.cursor, commands);
    let newSelection = null;
    if (state.selection) {
      const newStart = calculateFinalCursorPosition(
        state.selection.start,
        commands,
      );
      const newEnd = calculateFinalCursorPosition(
        state.selection.end,
        commands,
      );
      newSelection = { start: newStart, end: newEnd };
    }
    return { cursor: newCursor, selection: newSelection };
  }
}
