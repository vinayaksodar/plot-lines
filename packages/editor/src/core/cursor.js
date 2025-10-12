import {
  InsertCharCommand,
  InsertNewLineCommand,
  DeleteCharCommand,
  DeleteTextCommand,
  InsertTextCommand,
  ToggleInlineStyleCommand,
} from "./commands.js";

function cmpPos(a, b) {
  // Compare positions for convenience
  if (a.line < b.line) return -1;
  if (a.line > b.line) return 1;
  if (a.ch < b.ch) return -1;
  if (a.ch > b.ch) return 1;
  return 0;
}

function transformCursorPosition(pos, command) {
  if (!pos) {
    return null;
  }
  if (command instanceof InsertCharCommand) {
    // Shift chars on same line after insertion point
    if (pos.line === command.pos.line && pos.ch >= command.pos.ch) {
      return { line: pos.line, ch: pos.ch + 1 };
    }
  } else if (command instanceof DeleteCharCommand) {
    if (command.deletedChar === "\n") {
      // Deleting newline merges lines
      if (pos.line > command.pos.line + 1) {
        // Lines below deleted newline shift up
        return { line: pos.line - 1, ch: pos.ch };
      } else if (pos.line === command.pos.line + 1) {
        // Cursor on merged line shifts horizontally
        return { line: command.pos.line, ch: command.pos.ch + pos.ch };
      }
    } else if (pos.line === command.pos.line && pos.ch > command.pos.ch) {
      // Normal char deletion: shift left
      return { line: pos.line, ch: pos.ch - 1 };
    }
  } else if (command instanceof InsertTextCommand) {
    if (!command.text) return pos;
    const lines = command.text.split("\n");
    const lineCount = lines.length - 1;

    if (cmpPos(pos, command.pos) >= 0) {
      if (lineCount > 0) {
        // Multi-line insert
        return {
          line: pos.line + lineCount,
          ch:
            (pos.line === command.pos.line ? pos.ch - command.pos.ch : pos.ch) +
            lines[lineCount].length,
        };
      } else {
        // Single-line insert
        return { line: pos.line, ch: pos.ch + lines[0].length };
      }
    }
  } else if (command instanceof DeleteTextCommand) {
    // ✅ Corrected delete range handling (exclusive end)
    const { start, end } = command.range;

    if (cmpPos(pos, start) < 0) {
      // before start → unchanged
      return { ...pos };
    }

    if (cmpPos(pos, end) < 0) {
      // inside [start, end) → collapse to start
      return { ...start };
    }

    // after end
    if (start.line === end.line) {
      // single-line delete
      const removed = end.ch - start.ch;
      if (pos.line === start.line) {
        return { line: pos.line, ch: pos.ch - removed };
      }
      return { ...pos };
    } else {
      // multi-line delete
      const lineDiff = end.line - start.line;
      if (pos.line === end.line) {
        // tail of end line joins start line
        return {
          line: start.line,
          ch: start.ch + (pos.ch - end.ch),
        };
      } else if (pos.line > end.line) {
        // lines after end shift up
        return {
          line: pos.line - lineDiff,
          ch: pos.ch,
        };
      } else {
        // inside range
        return { ...start };
      }
    }
  } else if (command instanceof InsertNewLineCommand) {
    // Newline splits line
    if (pos.line > command.pos.line) {
      return { line: pos.line + 1, ch: pos.ch };
    } else if (pos.line === command.pos.line && pos.ch >= command.pos.ch) {
      return { line: pos.line + 1, ch: pos.ch - command.pos.ch };
    }
  } else if (command instanceof ToggleInlineStyleCommand) {
    // Do notheing
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
