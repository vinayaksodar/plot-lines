import {
  DeleteCharCommand,
  InsertCharCommand,
  InsertNewLineCommand,
  DeleteSelectionCommand,
} from "../commands.js";

export class KeyboardHandler {
  constructor(controller, inputElement) {
    this.controller = controller;
    this.inputElement = inputElement;

    this.inputElement.addEventListener("keydown", this.onKeyDown);
  }

  onKeyDown = (e) => {
    const { model, view, undoManager } = this.controller;

    // --- UNDO / REDO ---
    // Note: Undo/Redo is handled by the global keyboard handler in EditorController
    // to avoid conflicts with toolbar actions

    const isArrow =
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight";

    // --- SHIFT + ARROWS (extend selection) ---
    if (e.shiftKey && isArrow) {
      const dir = e.key.replace("Arrow", "").toLowerCase();
      model.extendSelection(dir);
      e.preventDefault();
      view.render();
      return;
    }

    // --- TYPING / EDITING ---
    if (model.hasSelection()) {
      if (e.key === "Backspace") {
        const cmd = new DeleteSelectionCommand(model);
        cmd.execute();
        undoManager.add(cmd);
      } else if (e.key === "Delete") {
        model.deleteSelection();
      } else if (e.key === "Escape") {
        model.clearSelection();
      } else if (e.key === "ArrowLeft") {
        model.moveCursorToSelectionStart();
      } else if (e.key === "ArrowRight") {
        model.moveCursorToSelectionEnd();
      }
    } else {
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        const cmd = new InsertCharCommand(model, model.cursor, e.key);
        cmd.execute();
        undoManager.add(cmd);
      } else if (e.key === "Enter") {
        const cmd = new InsertNewLineCommand(model);
        cmd.execute();
        undoManager.add(cmd);
      } else if (e.key === "Backspace") {
        const cmd = new DeleteCharCommand(model, model.cursor);
        cmd.execute();
        undoManager.add(cmd);
      } else if (isArrow) {
        model.moveCursor(e.key.replace("Arrow", "").toLowerCase());
      }
    }

    // --- CUT / COPY / PASTE ---
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      this.controller.handleCopy();
      e.preventDefault();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
      this.controller.handleCut();
      e.preventDefault();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
      this.controller.handlePaste();
      e.preventDefault();
      return;
    }
    // --- END CUT / COPY / PASTE ---

    e.preventDefault();
    view.render();
  };
}
