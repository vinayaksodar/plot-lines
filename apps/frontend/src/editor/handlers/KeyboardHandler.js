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
    if (this.handleCopyPaste(e)) return;

    const { model } = this.controller;
    const isArrowKey = e.key.startsWith("Arrow");

    if (e.shiftKey && isArrowKey) {
      this.handleArrowSelection(e);
    } else if (model.hasSelection()) {
      this.handleSelectionKeyDown(e);
    } else if (isArrowKey) {
      this.handleArrowMovement(e);
    } else {
      this.handleCharacterInput(e);
    }

    e.preventDefault();
    this.controller.view.render();
  };

  handleCopyPaste(e) {
    const isModifier = e.ctrlKey || e.metaKey;
    if (!isModifier) return false;

    const key = e.key.toLowerCase();
    if (key === "c") {
      this.controller.handleCopy();
    } else if (key === "x") {
      this.controller.handleCut();
    } else if (key === "v") {
      this.controller.handlePaste();
    } else {
      return false; // Not a copy/paste key
    }

    e.preventDefault();
    return true;
  }

  handleArrowSelection(e) {
    const { model } = this.controller;
    const direction = e.key.replace("Arrow", "").toLowerCase();

    if (!model.hasSelection()) {
      model.setSelection({ ...model.cursor }, { ...model.cursor });
    }

    const newEnd = this.calculateNewPosition(model.selection.end, direction);
    model.setSelection(model.selection.start, newEnd);
  }

  handleSelectionKeyDown(e) {
    const { model, undoManager } = this.controller;
    let cmd = null;

    if (e.key === "Backspace" || e.key === "Delete") {
      cmd = new DeleteSelectionCommand(model);
    } else if (e.key === "Escape") {
      model.clearSelection();
    } else if (e.key === "ArrowLeft") {
      model.moveCursorToSelectionStart();
    } else if (e.key === "ArrowRight") {
      model.moveCursorToSelectionEnd();
    }

    if (cmd) {
      cmd.execute();
      undoManager.add(cmd);
    }
  }

  handleArrowMovement(e) {
    const { model } = this.controller;
    const direction = e.key.replace("Arrow", "").toLowerCase();
    const newCursor = this.calculateNewPosition(model.cursor, direction);
    model.updateCursor(newCursor);
  }

  handleCharacterInput(e) {
    const { model, undoManager } = this.controller;
    let cmd = null;

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      cmd = new InsertCharCommand(model, model.cursor, e.key);
    } else if (e.key === "Enter") {
      cmd = new InsertNewLineCommand(model);
    } else if (e.key === "Backspace") {
      cmd = new DeleteCharCommand(model, model.cursor);
    }

    if (cmd) {
      cmd.execute();
      undoManager.add(cmd);
      this._handleAutoFormatting(e.key);
    }
  }

  calculateNewPosition(startPos, direction) {
    const { model, view } = this.controller;
    let { line, ch } = startPos;

    switch (direction) {
      case "left":
        if (ch > 0) ch--;
        else if (line > 0) {
          line--;
          ch = model.getLineLength(line);
        }
        break;
      case "right":
        if (ch < model.getLineLength(line)) ch++;
        else if (line < model.lines.length - 1) {
          line++;
          ch = 0;
        }
        break;
      case "up": {
        const { rowIndex, colInRow } = view.getRowPosition(line, ch);
        if (rowIndex > 0) {
          ch = view.getChFromRowPosition(line, rowIndex - 1, colInRow);
        } else if (line > 0) {
          const prevRows = view.getWrappedRows(line - 1);
          ch = view.getChFromRowPosition(
            line - 1,
            prevRows.length - 1,
            colInRow
          );
          line--;
        }
        break;
      }
      case "down": {
        const { rowIndex, colInRow } = view.getRowPosition(line, ch);
        const rows = view.getWrappedRows(line);
        if (rowIndex < rows.length - 1) {
          ch = view.getChFromRowPosition(line, rowIndex + 1, colInRow);
        } else if (line < model.lines.length - 1) {
          ch = view.getChFromRowPosition(line + 1, 0, colInRow);
          line++;
        }
        break;
      }
    }
    return { line, ch };
  }

  _handleAutoFormatting(key) {
    const { model, undoManager } = this.controller;
    const { line } = model.cursor;

    // Auto-switch to Dialogue or Action after Enter
    if (key === "Enter" && line > 0) {
      const prevLineType = model.lines[line - 1].type;
      const newType = {
        "scene-heading": "action",
        action: "action",
        character: "dialogue",
        parenthetical: "dialogue",
        dialogue: "action",
        transition: "scene-heading",
        shot: "action",
      }[prevLineType];

      if (newType) {
        const cmd = new SetLineTypeCommand(model, newType);
        cmd.execute();
        undoManager.add(cmd);
      }
    }

    // Set Scene Heading type
    const currentLine = model.lines[line];
    if (!currentLine) return;

    const lineText = currentLine.segments.map((s) => s.text).join("");
    let typeToSet = null;

    if (lineText.startsWith("INT.") || lineText.startsWith("EXT.")) {
      typeToSet = "scene-heading";
    }

    if (typeToSet && currentLine.type !== typeToSet) {
      const cmd = new SetLineTypeCommand(model, typeToSet);
      cmd.execute();
      undoManager.add(cmd);
    }
  }
}
