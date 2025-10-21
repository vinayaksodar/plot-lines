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
        line: this.pos.line - 1,
        ch: this.prevLineLength,
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
    this.range = range;
    this.richText = null;
  }

  execute(model) {
    if (!this.range) {
      console.error("DeleteTextCommand: Trying to delete an empty range");
      return;
    }
    this.richText = model.deleteText(this.range);
  }

  invert() {
    return new InsertTextCommand(this.richText, this.range.start);
  }

  toJSON() {
    return {
      type: "DeleteTextCommand",
      range: this.range,
    };
  }
}

export class InsertTextCommand {
  constructor(textOrRichText, pos) {
    if (Array.isArray(textOrRichText)) {
      this.richText = textOrRichText;
    } else {
      // Convert plain text to rich text structure
      this.richText = (textOrRichText || "").split("\n").map((lineText) => ({
        type: "action", // TODO: inherit from context
        segments: [
          { text: lineText, bold: false, italic: false, underline: false },
        ],
      }));
    }
    this.pos = pos;
  }

  execute(model) {
    model.insertRichText(this.richText, this.pos);
  }

  invert() {
    const endPos = {
      line: this.pos.line + this.richText.length - 1,
      ch:
        (this.richText.length > 1 ? 0 : this.pos.ch) +
        this.richText[this.richText.length - 1].segments
          .map((s) => s.text)
          .join("").length,
    };
    const range = { start: this.pos, end: endPos };
    return new DeleteTextCommand(range);
  }

  toJSON() {
    return {
      type: "InsertTextCommand",
      richText: this.richText,
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
