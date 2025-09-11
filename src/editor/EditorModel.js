export class EditorModel {
  constructor(text = "") {
    this.lines = text.split("\n");
    this.cursor = { line: 0, ch: 0 };
    this.selection = null; // {start:{line,ch}, end:{line,ch}}
  }

  insertChar(char) {
    const line = this.lines[this.cursor.line];
    const { ch } = this.cursor;
    this.lines[this.cursor.line] = line.slice(0, ch) + char + line.slice(ch);
    this.cursor.ch++;
  }

  deleteChar() {
    const { line, ch } = this.cursor;
    if (ch === 0 && line > 0) {
      const prev = this.lines[line - 1];
      const curr = this.lines[line];
      this.lines.splice(line, 1);
      this.cursor.line--;
      this.cursor.ch = prev.length;
      this.lines[this.cursor.line] += curr;
      return "\n"; // treat merge as newline deletion
    } else if (ch > 0) {
      const l = this.lines[line];
      const deleted = l[ch - 1];
      this.lines[line] = l.slice(0, ch - 1) + l.slice(ch);
      this.cursor.ch--;
      return deleted;
    }
    return null;
  }

  // Insert a new line at the current cursor position
  insertNewLine() {
    const { line, ch } = this.cursor;
    const currentLine = this.lines[line];
    const before = currentLine.slice(0, ch);
    const after = currentLine.slice(ch);
    this.lines.splice(line, 1, before, after);
    this.cursor.line++;
    this.cursor.ch = 0; // Move cursor to the start of the new line
  }

  setSelection(start, end) {
    this.selection = { start, end };
    // update cursor to be at end of selection
    this.updateCursor(end);
  }

  // just clear the selection without actually deleting it from the model
  clearSelection() {
    this.selection = null;
  }

  hasSelection() {
    return (
      this.selection &&
      this.selection.start &&
      this.selection.end &&
      (this.selection.start.line !== this.selection.end.line ||
        this.selection.start.ch !== this.selection.end.ch)
    );
  }

  getSelectedText() {
    if (!this.hasSelection()) return "";
    const { start, end } = this.normalizeSelection();
    const lines = this.lines.slice(start.line, end.line + 1);

    if (lines.length === 1) {
      return lines[0].slice(start.ch, end.ch);
    }

    lines[0] = lines[0].slice(start.ch);
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, end.ch);
    return lines.join("\n");
  }

  // switch start and end if selection is done by moving cursor up ie. start > end
  normalizeSelection() {
    const { start, end } = this.selection;
    if (
      start.line < end.line ||
      (start.line === end.line && start.ch <= end.ch)
    ) {
      return { start: { ...start }, end: { ...end } };
    }
    return { start: { ...end }, end: { ...start } };
  }

  insertText(text) {
    // Replace selection if present
    if (this.hasSelection()) {
      this.deleteSelection();
    }

    const linesToInsert = text.split("\n");

    if (linesToInsert.length === 1) {
      // Single line insert
      const { line, ch } = this.cursor;
      const currentLine = this.lines[line];
      this.lines[line] =
        currentLine.slice(0, ch) + linesToInsert[0] + currentLine.slice(ch);
      this.cursor.ch += linesToInsert[0].length;
      return;
    }

    const { line, ch } = this.cursor;
    const currentLine = this.lines[line];
    const before = currentLine.slice(0, ch);
    const after = currentLine.slice(ch);

    const newLines = [
      before + linesToInsert[0], // First line
      ...linesToInsert.slice(1, -1), // Middle lines (if any)
      linesToInsert.at(-1) + after, // Last line
    ];

    this.lines.splice(line, 1, ...newLines);

    // Update cursor to end of inserted text
    this.cursor.line = line + linesToInsert.length - 1;
    this.cursor.ch = linesToInsert.at(-1).length;
  }

  deleteSelection() {
    const { start, end } = this.normalizeSelection();
    const beforeSelInLine = this.lines[start.line].slice(0, start.ch);
    const afterSelInLine = this.lines[end.line].slice(end.ch);

    if (start.line == end.line) {
      this.lines[start.line] = beforeSelInLine + afterSelInLine;
    } else {
      this.lines.splice(
        start.line,
        end.line - start.line + 1,
        beforeSelInLine + afterSelInLine
      );
    }
    this.cursor = { ...start }; //make sure to pass a copy of start and not reference the start object itself
    this.clearSelection();
  }

  moveCursor(dir) {
    const { line, ch } = this.cursor;
    if (dir === "left") {
      if (ch > 0) this.cursor.ch--;
      else if (line > 0) {
        this.cursor.line--;
        this.cursor.ch = this.lines[this.cursor.line].length;
      }
    } else if (dir === "right") {
      if (ch < this.lines[line].length) this.cursor.ch++;
      else if (line < this.lines.length - 1) {
        this.cursor.line++;
        this.cursor.ch = 0;
      }
    } else if (dir === "up" && line > 0) {
      this.cursor.line--;
      this.cursor.ch = Math.min(
        this.cursor.ch,
        this.lines[this.cursor.line].length
      );
    } else if (dir === "down" && line < this.lines.length - 1) {
      this.cursor.line++;
      this.cursor.ch = Math.min(
        this.cursor.ch,
        this.lines[this.cursor.line].length
      );
    }
  }

  // move cursor to selection start
  moveCursorToSelectionStart() {
    if (this.hasSelection()) {
      const { start } = this.normalizeSelection();
      this.updateCursor({ line: start.line, ch: start.ch });
      this.clearSelection();
    }
  }

  // move cursor to selection end
  moveCursorToSelectionEnd() {
    if (this.hasSelection()) {
      const { end } = this.normalizeSelection();
      this.updateCursor({ line: end.line, ch: end.ch });
      this.clearSelection();
    }
  }

  // extend selection(used when user presses shift + arrow keys to select text)
  extendSelection(dir) {
    if (!this.hasSelection()) {
      // Anchor starts at current cursor
      this.setSelection(
        { line: this.cursor.line, ch: this.cursor.ch },
        { line: this.cursor.line, ch: this.cursor.ch }
      );
    }

    const { start, end } = this.selection; // not normalized
    let newEnd = { ...end };

    if (dir === "left") {
      if (newEnd.ch > 0) {
        newEnd.ch--;
      } else if (newEnd.line > 0) {
        newEnd.line--;
        newEnd.ch = this.lines[newEnd.line].length;
      }
    } else if (dir === "right") {
      if (newEnd.ch < this.lines[newEnd.line].length) {
        newEnd.ch++;
      } else if (newEnd.line < this.lines.length - 1) {
        newEnd.line++;
        newEnd.ch = 0;
      }
    } else if (dir === "up" && newEnd.line > 0) {
      if (newEnd.line > 0) {
        newEnd.line--;
        newEnd.ch = Math.min(newEnd.ch, this.lines[newEnd.line].length);
      } else {
        newEnd.ch = start.ch;
      }
    } else if (dir === "down") {
      if (newEnd.line < this.lines.length - 1) {
        newEnd.line++;
        newEnd.ch = Math.min(newEnd.ch, this.lines[newEnd.line].length);
      } else {
        newEnd.ch = this.lines[newEnd.line].length;
      }
    }
    if (start.line == newEnd.line && start.ch == newEnd.ch) {
      this.updateCursor({ ...start });
      this.clearSelection();
      return;
    }
    this.setSelection(start, newEnd);
  }
  updateCursor({ line, ch }) {
    this.cursor.line = line;
    this.cursor.ch = ch;
  }

  // Get all text as a single string
  getText() {
    return this.lines.join('\n');
  }

  // Set all text from a string
  setText(text) {
    this.lines = text.split('\n');
    // Ensure we always have at least one line
    if (this.lines.length === 0) {
      this.lines = [''];
    }
    this.cursor = { line: 0, ch: 0 };
    this.selection = null;
  }
}
