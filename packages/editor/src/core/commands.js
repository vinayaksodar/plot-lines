export class InsertCharCommand {
  constructor(pos, char) {
    this.pos = { ...pos };
    this.char = char;
  }

  execute(model) {
    model.insertChar(this.char, this.pos);
  }

  invert() {
    return new DeleteCharCommand({ line: this.pos.line, ch: this.pos.ch + 1 });
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
    model.insertNewLine(this.pos);
  }

  invert() {
    return new DeleteCharCommand({ line: this.pos.line + 1, ch: 0 });
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
    if (this.pos.ch === 0 && this.pos.line > 0) {
      this.prevLineLength = model.getLineLength(this.pos.line - 1);
    }
    this.deletedChar = model.deleteChar(this.pos);
  }

  invert() {
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

export class DeleteTextCommand {
  constructor(range) {
    this.text = null;
    this.range = range;
  }

  execute(model) {
    if (!this.range) {
      console.error("DeleteTextCommand: Trying to delete an empty range");
      return;
    }
    const range = this.range;
    this.text = model.getTextInRange(range);
    model.deleteText(this.range);
  }

  invert() {
    return new InsertTextCommand(this.text, this.range.start);
  }

  toJSON() {
    return {
      type: "DeleteTextCommand",
      range: this.range,
    };
  }
}

export class InsertTextCommand {
  constructor(text, pos) {
    this.text = text;
    this.pos = pos;
  }

  execute(model) {
    model.insertText(this.text, this.pos);
  }

  invert() {
    const endPos = {
      line: this.pos.line + this.text.split("\n").length - 1,
      ch:
        (this.text.split("\n").length > 1 ? 0 : this.pos.ch) +
        this.text.split("\n").pop().length,
    };
    const range = { start: this.pos, end: endPos };
    return new DeleteTextCommand(range);
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
  constructor(newType, pos) {
    this.newType = newType;
    this.oldType = null;
    this.pos = pos;
  }

  execute(model) {
    this.oldType = model.lines[this.pos.line].type;
    model.setLineType(this.pos.line, this.newType);
  }

  invert() {
    return new SetLineTypeCommand(this.oldType, this.pos);
  }

  toJSON() {
    return {
      type: "SetLineTypeCommand",
      newType: this.newType,
      pos: this.pos,
    };
  }
}

export class ToggleInlineStyleCommand {
  constructor(style, range) {
    this.style = style;
    this.range = range;
  }

  execute(model) {
    if (!this.range) return;
    model.toggleInlineStyle(this.style, this.range);
  }

  invert() {
    return this;
  }

  toJSON() {
    return {
      type: "ToggleInlineStyleCommand",
      style: this.style,
      range: this.range,
    };
  }
}
