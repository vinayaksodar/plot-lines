export class InsertCharCommand {
  constructor(pos, char) {
    this.pos = { ...pos };
    this.char = char;
  }

  execute(model) {
    console.log("[InsertCharCommand] execute", this.pos, this.char);
    model.cursor = { ...this.pos };
    model.insertChar(this.char);
  }

  undo(model) {
    console.log("[InsertCharCommand] undo");
    model.cursor = { line: this.pos.line, ch: this.pos.ch + 1 };
    model.deleteChar();
  }

  invert() {
    console.log("[InsertCharCommand] invert");
    return new DeleteCharCommand({ line: this.pos.line, ch: this.pos.ch + 1 });
  }

  mapPosition(pos) {
    console.log(
      "[InsertCharCommand] mapPosition, pos:",
      pos,
      "this.pos:",
      this.pos,
    );
    if (pos.line === this.pos.line && pos.ch >= this.pos.ch) {
      return { line: pos.line, ch: pos.ch + 1 };
    }
    return pos;
  }

  map(mapping) {
    console.log("[InsertCharCommand] map, mapping:", mapping);
    const newPos = mapping.map(this.pos);
    console.log("[InsertCharCommand] map, newPos:", newPos);
    return new InsertCharCommand(newPos, this.char);
  }

  clone(newPos) {
    return new InsertCharCommand(newPos, this.char);
  }

  toJSON() {
    return {
      type: "InsertCharCommand",
      pos: this.pos,
      char: this.char,
    };
  }
}

export class InsertNewLineCommand {
  constructor(pos) {
    this.pos = pos;
  }

  execute(model) {
    console.log("[InsertNewLineCommand] execute", this.pos);
    model.cursor = this.pos ? { ...this.pos } : { ...model.cursor };
    model.insertNewLine();
  }

  undo(model) {
    console.log("[InsertNewLineCommand] undo");
    model.cursor = { line: this.pos.line + 1, ch: 0 };
    model.deleteChar();
  }

  invert() {
    console.log("[InsertNewLineCommand] invert");
    return new DeleteCharCommand({ line: this.pos.line + 1, ch: 0 });
  }

  mapPosition(pos) {
    console.log(
      "[InsertNewLineCommand] mapPosition, pos:",
      pos,
      "this.pos:",
      this.pos,
    );
    if (pos.line > this.pos.line) {
      return { line: pos.line + 1, ch: pos.ch };
    } else if (pos.line === this.pos.line && pos.ch >= this.pos.ch) {
      return { line: pos.line + 1, ch: pos.ch - this.pos.ch };
    }
    return pos;
  }

  map(mapping) {
    console.log("[InsertNewLineCommand] map, mapping:", mapping);
    const newPos = mapping.map(this.pos);
    console.log("[InsertNewLineCommand] map, newPos:", newPos);
    return new InsertNewLineCommand(newPos);
  }

  clone(newPos) {
    return new InsertNewLineCommand(newPos);
  }

  toJSON() {
    return {
      type: "InsertNewLineCommand",
      pos: this.pos,
    };
  }
}

export class DeleteCharCommand {
  constructor(pos) {
    this.pos = { ...pos };
    this.deletedChar = null;
    this.prevLineLength = null;
  }

  execute(model) {
    console.log("[DeleteCharCommand] execute", this.pos);
    if (this.pos.ch === 0 && this.pos.line > 0) {
      this.prevLineLength = model.getLineLength(this.pos.line - 1);
    }
    model.cursor = { ...this.pos };
    this.deletedChar = model.deleteChar();
  }

  undo(model) {
    console.log("[DeleteCharCommand] undo");
    if (this.deletedChar === null) return;
    model.cursor = { line: this.pos.line, ch: this.pos.ch - 1 };
    if (this.deletedChar === "\n") {
      model.insertNewLine();
    } else {
      model.insertChar(this.deletedChar);
    }
  }

  invert() {
    console.log("[DeleteCharCommand] invert");
    if (this.deletedChar === "\n") {
      return new InsertNewLineCommand({
        line: this.pos.line,
        ch: this.pos.ch - 1,
      });
    } else {
      return new InsertCharCommand(
        { line: this.pos.line, ch: this.pos.ch - 1 },
        this.deletedChar,
      );
    }
  }

  mapPosition(pos) {
    console.log(
      "[DeleteCharCommand] mapPosition, pos:",
      pos,
      "this.pos:",
      this.pos,
    );
    if (this.deletedChar === "\n") {
      if (pos.line > this.pos.line) {
        return { line: pos.line - 1, ch: pos.ch };
      } else if (pos.line === this.pos.line) {
        return { line: this.pos.line - 1, ch: this.prevLineLength + pos.ch };
      }
    } else if (pos.line === this.pos.line && pos.ch >= this.pos.ch) {
      return { line: pos.line, ch: pos.ch - 1 };
    }
    return pos;
  }

  map(mapping) {
    console.log("[DeleteCharCommand] map, mapping:", mapping);
    const newPos = mapping.map(this.pos);
    console.log("[DeleteCharCommand] map, newPos:", newPos);
    return new DeleteCharCommand(newPos);
  }

  clone(newPos) {
    return new DeleteCharCommand(newPos);
  }

  toJSON() {
    return {
      type: "DeleteCharCommand",
      pos: this.pos,
    };
  }
}

export class DeleteSelectionCommand {
  constructor(selection) {
    this.text = null;
    this.selection = selection;
  }

  execute(model) {
    console.log("[DeleteSelectionCommand] execute", this.selection);
    if (!this.selection) {
      this.selection = model.selection;
    }
    model.selection = this.selection;
    this.text = model.getSelectedText();
    model.deleteSelection();
  }

  undo(model) {
    console.log("[DeleteSelectionCommand] undo");
    model.cursor = { ...this.selection.start };
    model.insertText(this.text);
    model.selection = { ...this.selection };
  }

  invert() {
    console.log("[DeleteSelectionCommand] invert");
    return new InsertTextCommand(this.text, this.selection.start);
  }

  mapPosition(pos) {
    console.log(
      "[DeleteSelectionCommand] mapPosition, pos:",
      pos,
      "this.selection:",
      this.selection,
    );
    const { start, end } = this.selection;
    if (pos.line < start.line) {
      return pos;
    }
    if (pos.line === start.line && pos.ch <= start.ch) {
      return pos;
    }
    if (pos.line > end.line) {
      return { line: pos.line - (end.line - start.line), ch: pos.ch };
    } else if (pos.line === end.line) {
      return { line: start.line, ch: start.ch + pos.ch - end.ch };
    } else {
      return { line: start.line, ch: start.ch };
    }
  }

  map(mapping) {
    console.log("[DeleteSelectionCommand] map, mapping:", mapping);
    const newSelection = {
      start: mapping.map(this.selection.start),
      end: mapping.map(this.selection.end),
    };
    console.log("[DeleteSelectionCommand] map, newSelection:", newSelection);
    return new DeleteSelectionCommand(newSelection);
  }

  clone(newSelection) {
    return new DeleteSelectionCommand(newSelection);
  }

  toJSON() {
    return {
      type: "DeleteSelectionCommand",
      selection: this.selection,
    };
  }
}

export class InsertTextCommand {
  constructor(text, pos) {
    this.text = text;
    this.pos = pos;
  }

  execute(model) {
    console.log("[InsertTextCommand] execute", this.pos, this.text);
    model.cursor = this.pos ? { ...this.pos } : { ...model.cursor };
    model.insertText(this.text);
  }

  undo(model) {
    console.log("[InsertTextCommand] undo");
    const endPos = {
      line: this.pos.line + this.text.split("\n").length - 1,
      ch:
        (this.text.split("\n").length > 1 ? 0 : this.pos.ch) +
        this.text.split("\n").pop().length,
    };
    model.selection = {
      start: { ...this.pos },
      end: endPos,
    };
    model.deleteSelection();
  }

  invert() {
    console.log("[InsertTextCommand] invert");
    const endPos = {
      line: this.pos.line + this.text.split("\n").length - 1,
      ch:
        (this.text.split("\n").length > 1 ? 0 : this.pos.ch) +
        this.text.split("\n").pop().length,
    };
    const selection = { start: this.pos, end: endPos };
    return new DeleteSelectionCommand(selection);
  }

  mapPosition(pos) {
    console.log(
      "[InsertTextCommand] mapPosition, pos:",
      pos,
      "this.pos:",
      this.pos,
    );
    const lines = this.text.split("\n");
    const endPos = {
      line: this.pos.line + lines.length - 1,
      ch: (lines.length > 1 ? 0 : this.pos.ch) + lines.pop().length,
    };

    if (pos.line < this.pos.line) {
      return pos;
    }
    if (pos.line === this.pos.line && pos.ch < this.pos.ch) {
      return pos;
    }

    if (pos.line === this.pos.line) {
      return { line: endPos.line, ch: endPos.ch + (pos.ch - this.pos.ch) };
    } else {
      return { line: pos.line + (endPos.line - this.pos.line), ch: pos.ch };
    }
  }

  map(mapping) {
    console.log("[InsertTextCommand] map, mapping:", mapping);
    const newPos = mapping.map(this.pos);
    console.log("[InsertTextCommand] map, newPos:", newPos);
    return new InsertTextCommand(this.text, newPos);
  }

  clone(newPos) {
    return new InsertTextCommand(this.text, newPos);
  }

  toJSON() {
    return {
      type: "InsertTextCommand",
      text: this.text,
      pos: this.pos,
    };
  }
}

export class SetLineTypeCommand {
  constructor(newType, selection, cursorLine) {
    this.newType = newType;
    this.oldTypes = [];
    this.selection = selection;
    this.cursorLine = cursorLine;
  }

  execute(model) {
    console.log(
      "[SetLineTypeCommand] execute",
      this.newType,
      this.selection,
      this.cursorLine,
    );

    // If context is not on the command, capture it from the model.
    if (!this.selection && this.cursorLine === undefined) {
      if (model.hasSelection()) {
        this.selection = model.normalizeSelection();
      } else {
        this.cursorLine = model.cursor.line;
      }
    }

    // Now, use the command's properties to execute the change.
    if (this.selection) {
      const { start, end } = this.selection;
      for (let i = start.line; i <= end.line; i++) {
        this.oldTypes.push({ line: i, type: model.lines[i].type });
        model.setLineType(i, this.newType);
      }
    } else {
      this.oldTypes.push({
        line: this.cursorLine,
        type: model.lines[this.cursorLine].type,
      });
      model.setLineType(this.cursorLine, this.newType);
    }
  }

  undo(model) {
    console.log("[SetLineTypeCommand] undo");
    for (const old of this.oldTypes) {
      model.setLineType(old.line, old.type);
    }
  }

  invert() {
    console.log("[SetLineTypeCommand] invert");
    const invertedCommands = this.oldTypes.map(
      (old) => new SetLineTypeCommand(old.type, this.selection, old.line),
    );
    return invertedCommands.length > 1 ? invertedCommands : invertedCommands[0];
  }

  mapPosition(pos) {
    return pos;
  }

  map(mapping) {
    console.log("[SetLineTypeCommand] map, mapping:", mapping);
    const newSelection = this.selection
      ? {
          start: mapping.map(this.selection.start),
          end: mapping.map(this.selection.end),
        }
      : null;
    const newCursorLine = mapping.map({ line: this.cursorLine, ch: 0 }).line;
    return new SetLineTypeCommand(this.newType, newSelection, newCursorLine);
  }

  clone(newSelection, newCursorLine) {
    return new SetLineTypeCommand(this.newType, newSelection, newCursorLine);
  }

  toJSON() {
    return {
      type: "SetLineTypeCommand",
      newType: this.newType,
      selection: this.selection,
      cursorLine: this.cursorLine,
    };
  }
}

export class ToggleInlineStyleCommand {
  constructor(style, selection) {
    this.style = style;
    this.selection = selection;
  }

  execute(model) {
    console.log(
      "[ToggleInlineStyleCommand] execute",
      this.style,
      this.selection,
    );
    // If no selection was provided to the command, grab it from the model.
    if (!this.selection) {
      this.selection = model.hasSelection() ? model.normalizeSelection() : null;
    }
    if (!this.selection) return;
    model.toggleInlineStyle(this.style, this.selection);
  }

  undo(model) {
    console.log("[ToggleInlineStyleCommand] undo");
    const selection =
      this.selection ||
      (model.hasSelection() ? model.normalizeSelection() : null);
    if (!selection) return;
    model.toggleInlineStyle(this.style, selection);
  }

  invert() {
    console.log("[ToggleInlineStyleCommand] invert");
    return new ToggleInlineStyleCommand(this.style, this.selection);
  }

  mapPosition(pos) {
    return pos;
  }

  map(mapping) {
    console.log("[ToggleInlineStyleCommand] map, mapping:", mapping);
    const newSelection = this.selection
      ? {
          start: mapping.map(this.selection.start),
          end: mapping.map(this.selection.end),
        }
      : null;
    return new ToggleInlineStyleCommand(this.style, newSelection);
  }

  clone(newSelection) {
    return new ToggleInlineStyleCommand(this.style, newSelection);
  }

  toJSON() {
    return {
      type: "ToggleInlineStyleCommand",
      style: this.style,
      selection: this.selection,
    };
  }
}
