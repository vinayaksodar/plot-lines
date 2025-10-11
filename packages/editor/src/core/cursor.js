import {
  InsertCharCommand,
  InsertNewLineCommand,
  DeleteCharCommand,
  DeleteTextCommand,
  InsertTextCommand,
  ToggleInlineStyleCommand,
} from "./commands.js";

function transformCursorPosition(pos, command) {
  if (command instanceof InsertCharCommand) {
    if (pos.line === command.pos.line && pos.ch >= command.pos.ch) {
      return { line: pos.line, ch: pos.ch + 1 };
    }
  } else if (command instanceof DeleteCharCommand) {
    if (command.deletedChar === "\n") {
      if (pos.line > command.pos.line - 1) {
        return { line: pos.line - 1, ch: pos.ch + command.prevLineLength };
      }
    } else if (pos.line === command.pos.line && pos.ch > command.pos.ch) {
      return { line: pos.line, ch: pos.ch - 1 };
    }
  } else if (command instanceof InsertTextCommand) {
    if (!command.text) return pos;
    const lines = command.text.split("\n");
    const lineCount = lines.length - 1;
    if (pos.line === command.pos.line && pos.ch >= command.pos.ch) {
      if (lineCount > 0) {
        return {
          line: pos.line + lineCount,
          ch: pos.ch - command.pos.ch + lines[lineCount].length,
        };
      } else {
        return { line: pos.line, ch: pos.ch + lines[0].length };
      }
    }
  } else if (command instanceof DeleteTextCommand) {
    const { start, end } = command.range;
    if (pos.line > end.line) {
      return { line: pos.line - (end.line - start.line), ch: pos.ch };
    } else if (pos.line === end.line) {
      return { line: start.line, ch: start.ch + (pos.ch - end.ch) };
    } else if (pos.line > start.line && pos.line < end.line) {
      return { ...start };
    }
  } else if (command instanceof InsertNewLineCommand) {
    if (pos.line > command.pos.line) {
      return { line: pos.line + 1, ch: pos.ch };
    } else if (pos.line === command.pos.line && pos.ch >= command.pos.ch) {
      return { line: pos.line + 1, ch: pos.ch - command.pos.ch };
    }
  } else if (command instanceof ToggleInlineStyleCommand) {
    return command.range.end;
  }

  return pos;
}

export function calculateFinalCursorPosition(initialCursor, commands) {
  let newPos = { ...initialCursor };
  for (const command of commands) {
    if (command.updateCursor === false) continue;
    newPos = transformCursorPosition(newPos, command);
  }
  return newPos;
}
