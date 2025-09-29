export class UndoManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];

    this.currentBatch = null; // array of commands in the active batch
    this.batchTimer = null; // timer to auto-close batch
    this.batchDelay = 500; // ms: how long between keypresses to merge into one batch
  }

  // Start a new batch explicitly
  beginBatch() {
    if (!this.currentBatch) {
      this.currentBatch = [];
    }
  }

  // End the current batch explicitly
  endBatch() {
    if (this.currentBatch && this.currentBatch.length > 0) {
      this.undoStack.push(this.currentBatch);
      this.currentBatch = null;
      this.redoStack = []; // clear redo history
    }
    this._clearBatchTimer();
  }

  // Add a command to the history (with batching)
  add(command) {
    if (this.currentBatch) {
      this.currentBatch.push(command);
    } else {
      // start a new batch automatically
      this.currentBatch = [command];
    }

    // reset batch timer: if user pauses typing, we finalize the batch
    this._clearBatchTimer();
    this.batchTimer = setTimeout(() => {
      this.endBatch();
    }, this.batchDelay);
  }

  getInvertedCommandsForUndo() {
    this._clearBatchTimer(); // finalize pending batch
    if (this.currentBatch) this.endBatch();

    if (!this.undoStack.length) return null;

    const batch = this.undoStack.pop();
    this.redoStack.push(batch);

    return batch.map(cmd => cmd.invert()).reverse();
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
