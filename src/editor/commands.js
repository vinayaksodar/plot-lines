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
