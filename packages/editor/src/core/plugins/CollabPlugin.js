import { Plugin } from "./Plugin.js";
import {
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

    this.unconfirmed = this._combineInsertText(this.unconfirmed);
    this.unconfirmed = this._combineDeleteText(this.unconfirmed);
  }

  _combineInsertText(unconfirmed) {
    if (unconfirmed.length < 2) {
      return unconfirmed;
    }

    const newUnconfirmed = [];
    let i = 0;
    while (i < unconfirmed.length) {
      const currentCommand = unconfirmed[i];

      // We only combine single-line, single-segment InsertTextCommands (i.e., from typing)
      if (
        currentCommand instanceof InsertTextCommand &&
        currentCommand.richText.length === 1 &&
        currentCommand.richText[0].segments.length === 1
      ) {
        let combinedRichText = JSON.parse(
          JSON.stringify(currentCommand.richText),
        );
        let startPos = currentCommand.pos;
        let lastIndex = i;

        for (let j = i + 1; j < unconfirmed.length; j++) {
          const nextCommand = unconfirmed[j];
          const combinedTextLength = getCommandText({
            richText: combinedRichText,
          }).length;

          if (
            nextCommand instanceof InsertTextCommand &&
            nextCommand.richText.length === 1 &&
            nextCommand.richText[0].segments.length === 1 &&
            nextCommand.pos.line === startPos.line &&
            nextCommand.pos.ch === startPos.ch + combinedTextLength
          ) {
            // Commands are contiguous. Now check styles.
            const lastSegment =
              combinedRichText[0].segments[
                combinedRichText[0].segments.length - 1
              ];
            const nextSegment = nextCommand.richText[0].segments[0];

            if (
              lastSegment.bold === nextSegment.bold &&
              lastSegment.italic === nextSegment.italic &&
              lastSegment.underline === nextSegment.underline
            ) {
              // Same style, merge text
              lastSegment.text += nextSegment.text;
            } else {
              // Different style, append segment
              combinedRichText[0].segments.push(nextSegment);
            }
            lastIndex = j;
          } else {
            break; // Sequence broken
          }
        }

        if (lastIndex > i) {
          // Combination happened
          const combinedCommand = new InsertTextCommand(
            combinedRichText,
            startPos,
          );
          newUnconfirmed.push(combinedCommand);
          i = lastIndex + 1;
        } else {
          // No combination
          newUnconfirmed.push(currentCommand);
          i++;
        }
      } else {
        // Not a combinable insert command
        newUnconfirmed.push(currentCommand);
        i++;
      }
    }
    return newUnconfirmed;
  }

  _combineDeleteText(unconfirmed) {
    if (unconfirmed.length < 2) {
      return unconfirmed;
    }

    const newUnconfirmed = [];
    let i = 0;
    while (i < unconfirmed.length) {
      const currentCommand = unconfirmed[i];
      const isSingleCharDelete =
        currentCommand instanceof DeleteTextCommand &&
        currentCommand.range.start.line === currentCommand.range.end.line &&
        currentCommand.range.end.ch === currentCommand.range.start.ch + 1;

      // Combine backward deletions
      if (isSingleCharDelete) {
        let combinedRange = { ...currentCommand.range };
        let lastIndex = i;

        for (let j = i + 1; j < unconfirmed.length; j++) {
          const nextCommand = unconfirmed[j];
          const isNextSingleCharDelete =
            nextCommand instanceof DeleteTextCommand &&
            nextCommand.range.start.line === nextCommand.range.end.line &&
            nextCommand.range.end.ch === nextCommand.range.start.ch + 1;

          // Check if the next deletion is immediately before the current combined range
          if (
            isNextSingleCharDelete &&
            nextCommand.range.start.line === combinedRange.start.line &&
            nextCommand.range.end.ch === combinedRange.start.ch
          ) {
            // Prepend the deletion
            combinedRange.start = nextCommand.range.start;
            lastIndex = j;
          } else {
            break; // Sequence broken
          }
        }

        if (lastIndex > i) {
          // Combination happened
          const combinedCommand = new DeleteTextCommand(combinedRange);
          newUnconfirmed.push(combinedCommand);
          i = lastIndex + 1;
        } else {
          newUnconfirmed.push(currentCommand);
          i++;
        }
      } else {
        newUnconfirmed.push(currentCommand);
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
    case "DeleteTextCommand":
      return new DeleteTextCommand(json.range);

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
    const cmp = (p1, p2) => {
      if (!p1 || !p2) return 0;
      if (p1.line < p2.line) return -1;
      if (p1.line > p2.line) return 1;
      if (p1.ch < p2.ch) return -1;
      if (p1.ch > p2.ch) return 1;
      return 0;
    };

    // Insert vs Insert
    if (
      localCmd instanceof InsertTextCommand &&
      remoteCmd instanceof InsertTextCommand
    ) {
      const remoteText = getCommandText(remoteCmd);
      if (cmp(localCmd.pos, remoteCmd.pos) >= 0) {
        const newPos = calculateFinalCursorPosition(localCmd.pos, [remoteCmd]);
        return new InsertTextCommand(localCmd.richText, newPos);
      }
      return localCmd;
    }

    // Delete vs Insert
    if (
      localCmd instanceof DeleteTextCommand &&
      remoteCmd instanceof InsertTextCommand
    ) {
      const newStart = calculateFinalCursorPosition(localCmd.range.start, [
        remoteCmd,
      ]);
      const newEnd = calculateFinalCursorPosition(localCmd.range.end, [
        remoteCmd,
      ]);
      return new DeleteTextCommand({ start: newStart, end: newEnd });
    }

    // Insert vs Delete
    if (
      localCmd instanceof InsertTextCommand &&
      remoteCmd instanceof DeleteTextCommand
    ) {
      if (cmp(localCmd.pos, remoteCmd.range.start) >= 0) {
        const newPos = calculateFinalCursorPosition(localCmd.pos, [remoteCmd]);
        return new InsertTextCommand(localCmd.richText, newPos);
      }
      return localCmd;
    }

    // Delete vs Delete
    if (
      localCmd instanceof DeleteTextCommand &&
      remoteCmd instanceof DeleteTextCommand
    ) {
      const { start: rStart, end: rEnd } = remoteCmd.range;
      const { start: lStart, end: lEnd } = localCmd.range;

      // If ranges are identical, drop the local command
      if (cmp(lStart, rStart) === 0 && cmp(lEnd, rEnd) === 0) {
        return null;
      }

      // If remote range completely contains local range, drop local
      if (cmp(rStart, lStart) <= 0 && cmp(rEnd, lEnd) >= 0) {
        return null;
      }

      // For other overlaps, the behavior can be complex. A simple approach is to
      // adjust the local command. A more robust solution would be needed for
      // complex partial overlaps, but for now, we adjust based on non-overlapping parts.
      const newStart = calculateFinalCursorPosition(lStart, [remoteCmd]);
      const newEnd = calculateFinalCursorPosition(lEnd, [remoteCmd]);

      if (cmp(newStart, newEnd) >= 0) {
        return null; // The command has become redundant
      }

      return new DeleteTextCommand({ start: newStart, end: newEnd });
    }

    // Fallback for other commands like SetLineType, etc.
    if (localCmd instanceof SetLineTypeCommand) {
      let lineCount = 0;
      if (
        remoteCmd instanceof InsertTextCommand &&
        remoteCmd.richText.length > 1
      ) {
        lineCount = remoteCmd.richText.length - 1;
      }

      if (lineCount > 0 && localCmd.pos.line >= remoteCmd.pos.line) {
        return new SetLineTypeCommand(localCmd.newType, {
          ...localCmd.pos,
          line: localCmd.pos.line + lineCount,
        });
      }
    }

    return localCmd; // Default to no-op for unhandled pairs
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
