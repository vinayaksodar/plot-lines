import {
  DeleteCharCommand,
  InsertCharCommand,
  InsertNewLineCommand,
  DeleteSelectionCommand,
  SetLineTypeCommand,
} from "../commands.js";

export class KeyboardHandler {
  constructor(controller, inputElement) {
    this.controller = controller;
    this.inputElement = inputElement;

    this.inputElement.addEventListener("keydown", this.onKeyDown);
  }

  onKeyDown = (e) => {
    const { model, view, undoManager } = this.controller;
    let cmd = null;

    const isArrow =
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight";

    if (e.shiftKey && isArrow) {
      const dir = e.key.replace("Arrow", "").toLowerCase();
      model.extendSelection(dir);
      e.preventDefault();
      view.render();
      return;
    }

    if (model.hasSelection()) {
      if (e.key === "Backspace") {
        cmd = new DeleteSelectionCommand(model);
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
        cmd = new InsertCharCommand(model, model.cursor, e.key);
      } else if (e.key === "Enter") {
        cmd = new InsertNewLineCommand(model);
      } else if (e.key === "Backspace") {
        cmd = new DeleteCharCommand(model, model.cursor);
      } else if (isArrow) {
        model.moveCursor(e.key.replace("Arrow", "").toLowerCase());
      }
    }

    if (cmd) {
      cmd.execute();
      undoManager.add(cmd);
      this._handleAutoFormatting(e.key);
    }

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

    e.preventDefault();
    view.render();
  };

  _handleAutoFormatting(key) {
    const { model, undoManager } = this.controller;
    const { line } = model.cursor;

    if (key === 'Enter' && line > 0) {
      const prevLine = model.lines[line - 1];
      let newType = null;

      if (prevLine.type === 'character') {
        newType = 'dialogue';
      } else if (prevLine.type === 'scene-heading') {
        newType = 'action';
      }

      if (newType) {
        const cmd = new SetLineTypeCommand(model, newType);
        cmd.execute();
        undoManager.add(cmd);
      }
    }

    const currentLine = model.lines[line];
    if (!currentLine) return;

    const lineText = currentLine.segments.map(s => s.text).join('').toUpperCase();
    let typeToSet = null;

    if (lineText.startsWith('INT.') || lineText.startsWith('EXT.')) {
      typeToSet = 'scene-heading';
    }

    if (typeToSet && currentLine.type !== typeToSet) {
      const cmd = new SetLineTypeCommand(model, typeToSet);
      cmd.execute();
      undoManager.add(cmd);
    }
  }
}
