// Insert a single character
export class InsertCharCommand {
  constructor(model, pos, char) {
    this.model = model;
    this.pos = { ...pos }; // pre-insert position
    this.char = char;
    this.afterPos = null; // store after insert
  }

  execute() {
    this.model.cursor = { ...this.pos };
    this.model.insertChar(this.char);
    this.afterPos = { ...this.model.cursor }; // capture after insert
  }

  undo() {
    this.model.cursor = { ...this.afterPos };
    this.model.deleteChar(); // now deletes the inserted char
  }
}

// Insert a newline
export class InsertNewLineCommand {
  constructor(model) {
    this.model = model;
    this.pos = { ...this.model.cursor };
    this.afterPos = null;
  }

  execute() {
    this.model.insertNewLine();
    this.afterPos = { ...this.model.cursor };
  }

  undo() {
    this.model.cursor = { ...this.afterPos };
    this.model.deleteChar(); // removes the newline
  }
}

// Delete a character
export class DeleteCharCommand {
  constructor(model, pos) {
    this.model = model;
    this.pos = { ...pos }; // cursor before deletion
    this.afterPos = null;
    this.deletedChar = null;
  }

  execute() {
    this.model.cursor = { ...this.pos };
    this.deletedChar = this.model.deleteChar();
    this.afterPos = { ...this.model.cursor };
  }

  undo() {
    if (this.deletedChar === null) return; // Nothing to undo
    this.model.cursor = { ...this.afterPos };
    if (this.deletedChar === "\n") {
      this.model.insertNewLine();
    } else {
      this.model.insertChar(this.deletedChar);
    }
  }
}

// Delete selection
export class DeleteSelectionCommand {
  constructor(model) {
    this.model = model;
    this.text = null;
    this.afterPos = null;
    this.selection = {
      start: { ...model.selection.start },
      end: { ...model.selection.end },
    };
  }

  execute() {
    this.model.selection = {
      start: { ...this.selection.start },
      end: { ...this.selection.end },
    };
    this.text = this.model.getSelectedText();
    this.model.deleteSelection();
    this.afterPos = { ...this.model.cursor };
  }

  undo() {
    this.model.cursor = { ...this.afterPos };
    this.model.insertText(this.text);
    this.model.selection = {
      start: { ...this.selection.start },
      end: { ...this.selection.end },
    };
  }
}

export class InsertTextCommand {
  constructor(model, text) {
    this.model = model;
    this.text = text;
    this.pos = { ...this.model.cursor };
    this.afterPos = null;
  }

  execute() {
    this.model.insertText(this.text);
    this.afterPos = { ...this.model.cursor };
  }

  undo() {
    this.model.selection = {
      start: { ...this.pos },
      end: { ...this.afterPos },
    };
    this.model.deleteSelection();
  }
}

export class SetLineTypeCommand {
  constructor(model, newType) {
    this.model = model;
    this.newType = newType;
    this.oldTypes = [];
    this.selection = model.hasSelection() ? model.normalizeSelection() : null;
    this.cursorLine = model.cursor.line;
  }

  execute() {
    if (this.selection) {
      const { start, end } = this.selection;
      for (let i = start.line; i <= end.line; i++) {
        this.oldTypes.push({ line: i, type: this.model.lines[i].type });
        this.model.setLineType(i, this.newType);
      }
    } else {
      this.oldTypes.push({
        line: this.cursorLine,
        type: this.model.lines[this.cursorLine].type,
      });
      this.model.setLineType(this.cursorLine, this.newType);
    }
  }

  undo() {
    for (const old of this.oldTypes) {
      this.model.setLineType(old.line, old.type);
    }
  }
}

export class ToggleInlineStyleCommand {
  constructor(model, style) {
    this.model = model;
    this.style = style;
    this.selection = model.hasSelection() ? model.normalizeSelection() : null;
    this.oldLines = [];
  }

  execute() {
    if (!this.selection) return;

    const { start, end } = this.selection;
    for (let i = start.line; i <= end.line; i++) {
      // Deep copy the line object to save its state
      this.oldLines.push({
        index: i,
        line: JSON.parse(JSON.stringify(this.model.lines[i])),
      });
    }

    this.model.toggleInlineStyle(this.style);
  }

  undo() {
    if (!this.selection) return;

    for (const oldLine of this.oldLines) {
      this.model.lines[oldLine.index] = oldLine.line;
    }
  }
}
