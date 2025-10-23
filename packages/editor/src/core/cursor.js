import { DeleteTextCommand, InsertTextCommand } from "./commands.js";

function cmpPos(a, b) {
  // Compare positions for convenience
  if (a.line < b.line) return -1;
  if (a.line > b.line) return 1;
  if (a.ch < b.ch) return -1;
  if (a.ch > b.ch) return 1;
  return 0;
}

export function transformCursorPosition(pos, command) {
  if (!pos) {
    return null;
  }
  if (command instanceof InsertTextCommand) {
    if (!command.richText || command.richText.length === 0) return pos;

    const lineCount = command.richText.length - 1;
    const lastLineLength = command.richText[lineCount].segments
      .map((s) => s.text)
      .join("").length;

    if (cmpPos(pos, command.pos) >= 0) {
      if (lineCount > 0) {
        // Multi-line insert
        return {
          line: pos.line + lineCount,
          ch:
            (pos.line === command.pos.line ? pos.ch - command.pos.ch : pos.ch) +
            lastLineLength,
        };
      } else {
        // Single-line insert
        return { line: pos.line, ch: pos.ch + lastLineLength };
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
