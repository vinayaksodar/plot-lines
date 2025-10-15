export class UndoManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];

    this.currentBatch = null; // object: { commands, preState, postState }
    this.batchTimer = null; // timer to auto-close batch
    this.batchDelay = 500; // ms: how long between keypresses to merge into one batch
    this.model = null;
  }

  setModel(model) {
    this.model = model;
  }

  // Start a new batch explicitly
  beginBatch() {
    if (!this.currentBatch) {
      this.currentBatch = {
        commands: [],
        preState: this.model
          ? {
              cursor: this.model.getCursorPos(),
              selection: this.model.getSelectionRange(),
            }
          : null,
        postState: null,
      };
    }
  }

  // End the current batch explicitly
  endBatch() {
    if (this.currentBatch && this.currentBatch.commands.length > 0) {
      if (this.model) {
        this.currentBatch.postState = {
          cursor: this.model.getCursorPos(),
          selection: this.model.getSelectionRange(),
        };
      }
      this.undoStack.push(this.currentBatch);
      this.currentBatch = null;
      this.redoStack = []; // clear redo history
    }
    this._clearBatchTimer();
  }

  // Add a command to the history (with batching)
  add(command) {
    const commandType = command.constructor.name;
    const commandShouldNotBeBatched = commandType === 'DeleteTextCommand' ||
                                    commandType === 'InsertTextCommand' ||
                                    commandType === 'ToggleInlineStyleCommand' ||
                                    commandType === 'SetLineTypeCommand';

    if (commandShouldNotBeBatched) {
      this.endBatch(); // Finalize any ongoing batch first.

      this.beginBatch(); // Start a new, separate batch.
      if (this.currentBatch) {
        this.currentBatch.commands.push(command);
      }
      this.endBatch(); // Immediately finalize the batch for this command.
    } else {
      // Default behavior for commands that can be batched (e.g., InsertCharCommand).
      if (!this.currentBatch) {
        this.beginBatch();
      }
      if (this.currentBatch) {
        this.currentBatch.commands.push(command);
      }

      // Reset batch timer: if user pauses typing, we finalize the batch.
      this._clearBatchTimer();
      this.batchTimer = setTimeout(() => {
        this.endBatch();
      }, this.batchDelay);
    }
  }

  getCommandsForUndo() {
    this._clearBatchTimer(); // finalize pending batch
    if (this.currentBatch) this.endBatch();

    if (!this.undoStack.length) return null;

    const batch = this.undoStack.pop();
    this.redoStack.push(batch);

    return batch;
  }

  getCommandsForRedo() {
    if (!this.redoStack.length) return null;

    const batch = this.redoStack.pop();
    this.undoStack.push(batch);

    return batch;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.currentBatch = null;
    this._clearBatchTimer();
  }

  // Utility: check if undo/redo is available
  canUndo() {
    return (
      this.undoStack.length > 0 ||
      (this.currentBatch && this.currentBatch.length > 0)
    );
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