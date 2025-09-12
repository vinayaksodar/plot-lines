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

      if (!model.hasSelection()) {
        model.setSelection({ ...model.cursor }, { ...model.cursor });
      }

      const { end } = model.selection;
      let newEnd = { ...end };

      // Create a temporary cursor from the selection end
      const tempCursor = { ...newEnd };

      if (dir === "left") {
        if (tempCursor.ch > 0) {
          tempCursor.ch--;
        } else if (tempCursor.line > 0) {
          tempCursor.line--;
          tempCursor.ch = model.getLineLength(tempCursor.line);
        }
      } else if (dir === "right") {
        if (tempCursor.ch < model.getLineLength(tempCursor.line)) {
          tempCursor.ch++;
        } else if (tempCursor.line < model.lines.length - 1) {
          tempCursor.line++;
          tempCursor.ch = 0;
        }
      } else if (dir === "up") {
        const { rowIndex, colInRow } = view.getRowPosition(
          tempCursor.line,
          tempCursor.ch
        );

        if (rowIndex > 0) {
          // Move up within the same line
          const targetCh = view.getChFromRowPosition(
            tempCursor.line,
            rowIndex - 1,
            colInRow
          );
          tempCursor.ch = targetCh;
        } else if (tempCursor.line > 0) {
          // Move to previous line’s last row
          const prevRows = view.getWrappedRows(tempCursor.line - 1);
          const targetCh = view.getChFromRowPosition(
            tempCursor.line - 1,
            prevRows.length - 1,
            colInRow
          );
          tempCursor.line--;
          tempCursor.ch = targetCh;
        }
      } else if (dir === "down") {
        const { rowIndex, colInRow } = view.getRowPosition(
          tempCursor.line,
          tempCursor.ch
        );
        const rows = view.getWrappedRows(tempCursor.line);

        if (rowIndex < rows.length - 1) {
          // Move down within same line
          const targetCh = view.getChFromRowPosition(
            tempCursor.line,
            rowIndex + 1,
            colInRow
          );
          tempCursor.ch = targetCh;
        } else if (tempCursor.line < model.lines.length - 1) {
          // Move to next line’s first row
          const targetCh = view.getChFromRowPosition(
            tempCursor.line + 1,
            0,
            colInRow
          );
          tempCursor.line++;
          tempCursor.ch = targetCh;
        }
      }

      model.setSelection(model.selection.start, tempCursor);
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
        const { line, ch } = model.cursor;

        if (e.key === "ArrowLeft") {
          if (ch > 0) {
            model.updateCursor({ line, ch: ch - 1 });
          } else if (line > 0) {
            model.updateCursor({
              line: line - 1,
              ch: model.getLineLength(line - 1),
            });
          }
        } else if (e.key === "ArrowRight") {
          const lineLength = model.getLineLength(line);
          if (ch < lineLength) {
            model.updateCursor({ line, ch: ch + 1 });
          } else if (line < model.lines.length - 1) {
            model.updateCursor({ line: line + 1, ch: 0 });
          }
        } else if (e.key === "ArrowUp") {
          const { rowIndex, colInRow } = view.getRowPosition(line, ch);

          if (rowIndex > 0) {
            // Move up within same line
            const targetCh = view.getChFromRowPosition(
              line,
              rowIndex - 1,
              colInRow
            );
            model.updateCursor({ line, ch: targetCh });
          } else if (line > 0) {
            // Move to previous line’s last row
            const prevRows = view.getWrappedRows(line - 1);
            const targetCh = view.getChFromRowPosition(
              line - 1,
              prevRows.length - 1,
              colInRow
            );
            model.updateCursor({ line: line - 1, ch: targetCh });
          }
        } else if (e.key === "ArrowDown") {
          const { rowIndex, colInRow } = view.getRowPosition(line, ch);
          const rows = view.getWrappedRows(line);

          if (rowIndex < rows.length - 1) {
            // Move down within same line
            const targetCh = view.getChFromRowPosition(
              line,
              rowIndex + 1,
              colInRow
            );
            model.updateCursor({ line, ch: targetCh });
          } else if (line < model.lines.length - 1) {
            // Move to next line’s first row
            const targetCh = view.getChFromRowPosition(line + 1, 0, colInRow);
            model.updateCursor({ line: line + 1, ch: targetCh });
          }
        }
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

    if (key === "Enter" && line > 0) {
      const prevLine = model.lines[line - 1];
      let newType = null;

      if (prevLine.type === "character") {
        newType = "dialogue";
      } else if (prevLine.type === "scene-heading") {
        newType = "action";
      }

      if (newType) {
        const cmd = new SetLineTypeCommand(model, newType);
        cmd.execute();
        undoManager.add(cmd);
      }
    }

    const currentLine = model.lines[line];
    if (!currentLine) return;

    const lineText = currentLine.segments
      .map((s) => s.text)
      .join("")
      .toUpperCase();
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
