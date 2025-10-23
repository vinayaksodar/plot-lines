import {
  DeleteTextCommand,
  InsertTextCommand,
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

    const model = this.controller.model;
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
    const model = this.controller.model;
    const direction = e.key.replace("Arrow", "").toLowerCase();

    const cursorPos = model.getCursorPos();
    if (!model.hasSelection()) {
      if (!cursorPos) {
        return;
      }
      model.setSelectionRange({ start: cursorPos, end: cursorPos });
    }
    const { start, end } = model.getSelectionRange();
    if (
      start.ch == cursorPos.ch &&
      start.line == cursorPos.line &&
      end.ch == cursorPos.ch &&
      end.line == cursorPos.line
    ) {
      if (direction == "right" || direction == "down") {
        const newEnd = this.calculateNewPosition(start, direction);
        model.setSelectionRange({ start, end: newEnd });
        model.updateCursor(newEnd);
      }
      if (direction == "left" || direction == "up") {
        const newStart = this.calculateNewPosition(start, direction);
        model.setSelectionRange({ start: newStart, end });
        model.updateCursor(newStart);
      }
    }
    if (start.ch == cursorPos.ch && start.line == cursorPos.line) {
      const newStart = this.calculateNewPosition(start, direction);
      model.setSelectionRange({ start: newStart, end });
      model.updateCursor(newStart);
    }
    if (end.ch == cursorPos.ch && end.line == cursorPos.line) {
      const newEnd = this.calculateNewPosition(end, direction);
      model.setSelectionRange({ start, end: newEnd });
      model.updateCursor(newEnd);
    }
  }

  handleSelectionKeyDown(e) {
    const model = this.controller.model;
    let cmd = null;

    if (e.key === "Backspace" || e.key === "Delete") {
      cmd = new DeleteTextCommand(model.getSelectionRange());
    } else if (e.key === "Escape") {
      model.clearSelection();
    } else if (e.key === "ArrowLeft") {
      model.moveCursorToSelectionStart();
    } else if (e.key === "ArrowRight") {
      model.moveCursorToSelectionEnd();
    }

    if (cmd) {
      this.controller.executeCommands([cmd]);
    }
  }

  handleArrowMovement(e) {
    const model = this.controller.model;
    const direction = e.key.replace("Arrow", "").toLowerCase();
    const newPos = this.calculateNewPosition(model.getCursorPos(), direction);
    model.updateCursor(newPos);
  }

  handleCharacterInput(e) {
    const model = this.controller.model;
    let cmd = null;
    const pos = model.getCursorPos();

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const lineType = model.lines[pos.line].type;
      let style = { bold: false, italic: false, underline: false };

      if (pos.ch > 0) {
        const richTextSample = model.getRichTextInRange({
          start: { line: pos.line, ch: pos.ch - 1 },
          end: pos,
        });
        if (richTextSample[0]?.segments[0]) {
          const { text, ...segmentStyle } = richTextSample[0].segments[0];
          style = segmentStyle;
        }
      }

      const richText = [
        {
          type: lineType,
          segments: [{ text: e.key, ...style }],
        },
      ];
      cmd = new InsertTextCommand(richText, pos);
      this.controller.executeCommands([cmd]);
    } else if (e.key === "Enter") {
      const prevLineType = model.lines[pos.line].type;
      let newType = {
        "scene-heading": "action",
        action: "action",
        character: "dialogue",
        parenthetical: "dialogue",
        dialogue: "action",
        transition: "scene-heading",
        shot: "action",
      }[prevLineType];

      if (!newType) {
        newType = "action"; // Default fallback
      }

      const richText = [
        { type: prevLineType, segments: [] },
        { type: newType, segments: [] },
      ];
      cmd = new InsertTextCommand(richText, pos);
      this.controller.executeCommands([cmd]);
    } else if (e.key === "Backspace") {
      if (pos.line === 0 && pos.ch === 0) return; // Nothing to delete
      const start = this.calculateNewPosition(pos, "left");
      cmd = new DeleteTextCommand({ start, end: pos });
      this.controller.executeCommands([cmd]);
    } else if (e.key === "Delete") {
      const lineLen = model.getLineLength(pos.line);
      if (pos.line === model.lines.length - 1 && pos.ch === lineLen) {
        return; // Nothing to delete
      }
      const end = this.calculateNewPosition(pos, "right");
      cmd = new DeleteTextCommand({ start: pos, end });
      this.controller.executeCommands([cmd]);
    }

    if (cmd) {
      this._handleAutoFormatting(e.key);
    }
  }

  calculateNewPosition(startPos, direction) {
    const model = this.controller.model;
    const view = this.controller.view;
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
            colInRow,
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
    const model = this.controller.model;
    const { line } = model.getCursorPos();

    // Set Scene Heading type
    const currentLine = model.lines[line];
    if (!currentLine) return;

    const lineText = currentLine.segments.map((s) => s.text).join("");
    let typeToSet = null;

    if (lineText.startsWith("INT.") || lineText.startsWith("EXT.")) {
      typeToSet = "scene-heading";
    }

    if (typeToSet && currentLine.type !== typeToSet) {
      const cmd = new SetLineTypeCommand(typeToSet, model.getCursorPos());
      this.controller.executeCommands([cmd]);
    }
  }
}
