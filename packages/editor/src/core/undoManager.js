export class UndoManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];

    this.currentBatch = null; // array of { command, preState, postState }
    this.batchTimer = null; // timer to auto-close batch
    this.batchDelay = 500; // ms: how long between keypresses to merge into one batch
  }

  // Start a new batch explicitly
  beginBatch() {
    console.log("UndoManager: beginBatch called.");
    if (!this.currentBatch) {
      this.currentBatch = [];
    }
  }

  // End the current batch explicitly
  endBatch() {
    if (this.currentBatch && this.currentBatch.length > 0) {
      console.log(
        "UndoManager: endBatch called. Pushing batch to undoStack. Batch content:",
        JSON.stringify(this.currentBatch),
      );
      this.undoStack.push(this.currentBatch);
      this.currentBatch = null;
    }
    this._clearBatchTimer();
  }

  // Add a command to the history (with batching)
  add(command, preState, postState, forceBatch = false) {
    // Any new edit invalidates redo history this is important don't remove this.
    this.redoStack = [];

    const commandType = command.constructor.name;
    console.log(
      "UndoManager: add called for command type:",
      commandType,
      "Current batch size:",
      this.currentBatch ? this.currentBatch.length : 0,
      "Force batch:",
      forceBatch,
    );

    if (forceBatch) {
      if (!this.currentBatch) {
        this.beginBatch();
      }
      this.currentBatch.push({ command, preState, postState });
      return;
    }

    const commandShouldBeDiscrete =
      (commandType === "InsertTextCommand" &&
        !(
          // Not a single-character insert
          (
            command.richText.length === 1 &&
            command.richText[0].segments.length === 1 &&
            command.richText[0].segments[0].text.length === 1
          )
        )) ||
      (commandType === "DeleteTextCommand" &&
        !(
          // Not a single-character delete
          (
            command.range.start.line === command.range.end.line &&
            command.range.end.ch === command.range.start.ch + 1
          )
        ));

    if (commandShouldBeDiscrete) {
      console.log(
        "UndoManager: Command is discrete, ending current batch and starting new one.",
      );
      this.endBatch(); // Finalize any ongoing batch first.

      this.beginBatch(); // Start a new, separate batch.
      if (this.currentBatch) {
        this.currentBatch.push({ command, preState, postState });
      }
      this.endBatch(); // Immediately finalize the batch for this command.
    } else {
      // Default behavior for commands that can be batched (single-char InsertText, single-char DeleteText).
      if (!this.currentBatch) {
        console.log("UndoManager: No current batch, beginning new batch.");
        this.beginBatch();
      }
      if (this.currentBatch) {
        this.currentBatch.push({ command, preState, postState });
      }

      // Reset batch timer: if user pauses typing, we finalize the batch.
      this._clearBatchTimer();
      this.batchTimer = setTimeout(() => {
        console.log("UndoManager: Batch timer expired, ending batch.");
        this.endBatch();
      }, this.batchDelay);
    }
  }

  getCommandsForUndo() {
    console.log(
      "UndoManager: getCommandsForUndo called. undoStack length:",
      this.undoStack.length,
    );
    this._clearBatchTimer(); // finalize pending batch
    if (this.currentBatch) this.endBatch();

    if (!this.undoStack.length) {
      console.log("UndoManager: undoStack is empty.");
      return null;
    }

    const batch = this.undoStack.pop();
    this.redoStack.push([...batch]); // Push a shallow copy
    console.log(
      "UndoManager: Popped batch from undoStack, pushed to redoStack. redoStack length:",
      this.redoStack.length,
      "Batch content:",
      JSON.stringify(batch),
    );

    return batch;
  }

  getCommandsForRedo() {
    console.log(
      "UndoManager: getCommandsForRedo called. redoStack length:",
      this.redoStack.length,
    );
    if (!this.redoStack.length) {
      console.log("UndoManager: redoStack is empty.");
      return null;
    }

    const batch = this.redoStack.pop();
    this.undoStack.push([...batch]); // Push a shallow copy
    console.log(
      "UndoManager: Popped batch from redoStack, pushed to undoStack. undoStack length:",
      this.undoStack.length,
      "Batch content:",
      JSON.stringify(batch),
    );

    return batch;
  }

  clear() {
    console.log("UndoManager: clear called. Clearing all stacks.");
    this.undoStack = [];
    this.redoStack = [];
    this.currentBatch = null;
    this._clearBatchTimer();
  }

  // Utility: check if undo/redo is available
  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  // Internal helper to clear batch timer
  _clearBatchTimer() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}
