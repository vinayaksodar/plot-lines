export class EditorModel {
  constructor(text = "") {
    this.lines = [];
    this.setText(text);
    this.cursor = { line: 0, ch: 0 };
    this.selection = null; // {start:{line,ch}, end:{line,ch}}
  }

  // Find the segment and offset within it for a given character position in a line
  _findSegmentAt(lineIndex, ch) {
    const line = this.lines[lineIndex];
    let chCount = 0;
    for (let i = 0; i < line.segments.length; i++) {
      const segment = line.segments[i];
      if (chCount + segment.text.length >= ch) {
        return { segment, segmentIndex: i, offset: ch - chCount };
      }
      chCount += segment.text.length;
    }
    // If ch is at the very end of the line
    const lastSegment = line.segments[line.segments.length - 1] || { text: "" };
    return {
      segment: lastSegment,
      segmentIndex: line.segments.length - 1,
      offset: lastSegment.text.length,
    };
  }

  // Get the total character length of a line
  getLineLength(lineIndex) {
    return this.lines[lineIndex].segments.reduce(
      (len, seg) => len + seg.text.length,
      0
    );
  }

  // Merge adjacent segments in a line if they have identical styles
  _mergeSegments(lineIndex) {
    const line = this.lines[lineIndex];
    if (!line || !line.segments || line.segments.length < 2) {
      return;
    }

    const newSegments = [line.segments[0]];
    for (let i = 1; i < line.segments.length; i++) {
      const current = line.segments[i];
      const previous = newSegments[newSegments.length - 1];

      // Check if styles are identical
      if (
        current.bold === previous.bold &&
        current.italic === previous.italic &&
        current.underline === previous.underline
      ) {
        previous.text += current.text; // Merge
      } else {
        newSegments.push(current);
      }
    }
    this.lines[lineIndex].segments = newSegments.filter(
      (seg) => seg.text.length > 0
    );
  }

  insertChar(char) {
    if (this.hasSelection()) {
      this.deleteSelection();
    }

    const { line, ch } = this.cursor;
    const { segment, segmentIndex, offset } = this._findSegmentAt(line, ch);

    // Insert character into the segment's text
    segment.text =
      segment.text.slice(0, offset) + char + segment.text.slice(offset);

    this.cursor.ch++;
  }

  deleteChar() {
    if (this.hasSelection()) {
      this.deleteSelection();
      return null; // Indicate that a selection was deleted
    }

    const { line, ch } = this.cursor;

    if (ch === 0 && line > 0) {
      // Merging with the previous line
      const prevLineLength = this.getLineLength(line - 1);
      const currentLine = this.lines[line];

      // Append current line's segments to the previous line
      this.lines[line - 1].segments.push(...currentLine.segments);
      this.lines.splice(line, 1); // Remove the current line

      this._mergeSegments(line - 1); // Merge segments after joining lines

      this.cursor.line--;
      this.cursor.ch = prevLineLength;
      return "\n"; // Return newline to indicate a line merge
    } else if (ch > 0) {
      const { segment, offset } = this._findSegmentAt(line, ch);
      const deletedChar = segment.text[offset - 1];
      segment.text =
        segment.text.slice(0, offset - 1) + segment.text.slice(offset);
      this.cursor.ch--;
      this._mergeSegments(line);
      return deletedChar;
    }
    return null; // Nothing was deleted
  }

  insertNewLine() {
    if (this.hasSelection()) {
      this.deleteSelection();
    }

    const { line, ch } = this.cursor;
    const { segment, segmentIndex, offset } = this._findSegmentAt(line, ch);

    const currentLine = this.lines[line];
    const textAfter = segment.text.slice(offset);
    segment.text = segment.text.slice(0, offset);

    // Segments to be moved to the new line
    const segmentsForNewLine = [
      { ...segment, text: textAfter }, // The second half of the split segment
      ...currentLine.segments.slice(segmentIndex + 1),
    ];

    // Remove the moved segments from the current line
    currentLine.segments.splice(segmentIndex + 1);

    const newLine = {
      type: currentLine.type, // Inherit type from the current line
      segments: segmentsForNewLine,
    };

    this.lines.splice(line + 1, 0, newLine);

    this.cursor.line++;
    this.cursor.ch = 0;
  }

  setSelection(start, end) {
    this.selection = { start, end };
    this.updateCursor(end);
  }

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
    let text = "";

    for (let i = start.line; i <= end.line; i++) {
      const line = this.lines[i];
      const lineText = line.segments.map((s) => s.text).join("");

      if (i === start.line && i === end.line) {
        // Single line selection
        text += lineText.slice(start.ch, end.ch);
      } else if (i === start.line) {
        // First line of multi-line selection
        text += lineText.slice(start.ch) + "\n";
      } else if (i === end.line) {
        // Last line of multi-line selection
        text += lineText.slice(0, end.ch);
      } else {
        // Full line in between
        text += lineText + "\n";
      }
    }
    return text;
  }

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
    if (this.hasSelection()) {
      this.deleteSelection();
    }

    const linesToInsert = text.split("\n");
    const { line, ch } = this.cursor;

    // Create new segments for the inserted text
    const newSegments = linesToInsert.map((lineText) => ({
      text: lineText,
      bold: false,
      italic: false,
      underline: false,
    }));

    if (newSegments.length === 1) {
      // Single line insert
      const { segment, segmentIndex, offset } = this._findSegmentAt(line, ch);
      segment.text =
        segment.text.slice(0, offset) +
        newSegments[0].text +
        segment.text.slice(offset);
      this.cursor.ch += newSegments[0].text.length;
      this._mergeSegments(line);
    } else {
      // Multi-line insert
      const { segment, segmentIndex, offset } = this._findSegmentAt(line, ch);
      const lineObj = this.lines[line];

      const textAfter = segment.text.slice(offset);
      segment.text = segment.text.slice(0, offset);

      // First line of insert
      lineObj.segments[segmentIndex].text += newSegments[0].text;

      // Segments to be moved to the last new line
      const remainingSegments = [
        { ...segment, text: textAfter },
        ...lineObj.segments.slice(segmentIndex + 1),
      ];
      lineObj.segments.splice(segmentIndex + 1);

      const newLines = [];
      // Middle lines
      for (let i = 1; i < newSegments.length - 1; i++) {
        newLines.push({ type: lineObj.type, segments: [newSegments[i]] });
      }

      // Last line
      const lastNewLine = {
        type: lineObj.type,
        segments: [newSegments[newSegments.length - 1], ...remainingSegments],
      };
      newLines.push(lastNewLine);

      this.lines.splice(line + 1, 0, ...newLines);

      this.cursor.line += newLines.length;
      this.cursor.ch = this.getLineLength(this.cursor.line) - textAfter.length;
    }
  }

  deleteSelection() {
    if (!this.hasSelection()) return;

    const { start, end } = this.normalizeSelection();

    // Find segments at start and end
    const { segment: startSegment, offset: startOffset } = this._findSegmentAt(
      start.line,
      start.ch
    );
    const { segment: endSegment, offset: endOffset } = this._findSegmentAt(
      end.line,
      end.ch
    );

    // Get segments from the end line that are after the selection
    const remainingSegments = [
      { ...endSegment, text: endSegment.text.slice(endOffset) },
    ];

    // Trim the start segment
    startSegment.text = startSegment.text.slice(0, startOffset);

    // Merge the start line with the remaining parts of the end line
    this.lines[start.line].segments.push(...remainingSegments);

    // Remove all lines between start and end
    if (start.line < end.line) {
      this.lines.splice(start.line + 1, end.line - start.line);
    }

    this._mergeSegments(start.line);

    this.cursor = { ...start };
    this.clearSelection();
  }

  moveCursor(dir) {
    const { line, ch } = this.cursor;
    if (dir === "left") {
      if (ch > 0) this.cursor.ch--;
      else if (line > 0) {
        this.cursor.line--;
        this.cursor.ch = this.getLineLength(this.cursor.line);
      }
    } else if (dir === "right") {
      if (ch < this.getLineLength(line)) this.cursor.ch++;
      else if (line < this.lines.length - 1) {
        this.cursor.line++;
        this.cursor.ch = 0;
      }
    } else if (dir === "up" && line > 0) {
      this.cursor.line--;
      this.cursor.ch = Math.min(ch, this.getLineLength(this.cursor.line));
    } else if (dir === "down" && line < this.lines.length - 1) {
      this.cursor.line++;
      this.cursor.ch = Math.min(ch, this.getLineLength(this.cursor.line));
    }
  }

  moveCursorToSelectionStart() {
    if (this.hasSelection()) {
      const { start } = this.normalizeSelection();
      this.updateCursor({ line: start.line, ch: start.ch });
      this.clearSelection();
    }
  }

  moveCursorToSelectionEnd() {
    if (this.hasSelection()) {
      const { end } = this.normalizeSelection();
      this.updateCursor({ line: end.line, ch: end.ch });
      this.clearSelection();
    }
  }

  

  updateCursor({ line, ch }) {
    this.cursor.line = line;
    this.cursor.ch = ch;
  }

  getText() {
    return this.lines
      .map((line) => line.segments.map((s) => s.text).join(""))
      .join("\n");
  }

  setText(text) {
    this.lines = text.split("\n").map((lineText) => ({
      type: "action", // Default line type
      segments: [
        { text: lineText, bold: false, italic: false, underline: false },
      ],
    }));
    if (this.lines.length === 0) {
      this.lines = [
        {
          type: "action",
          segments: [
            { text: "", bold: false, italic: false, underline: false },
          ],
        },
      ];
    }
    this.cursor = { line: 0, ch: 0 };
    this.selection = null;
  }

  // --- New Methods for Screenplay and Rich Text ---

  setLineType(lineIndex, type) {
    if (this.lines[lineIndex]) {
      this.lines[lineIndex].type = type;
    }
  }

  setSelectionLineType(type) {
    if (!this.hasSelection()) {
      this.setLineType(this.cursor.line, type);
      return;
    }

    const { start, end } = this.normalizeSelection();
    for (let i = start.line; i <= end.line; i++) {
      this.setLineType(i, type);
    }
  }

  toggleInlineStyle(style) {
    if (!this.hasSelection()) return;

    const { start, end } = this.normalizeSelection();

    for (let i = start.line; i <= end.line; i++) {
      const line = this.lines[i];
      const startCh = i === start.line ? start.ch : 0;
      const endCh = i === end.line ? end.ch : this.getLineLength(i);

      let chCount = 0;
      const newSegments = [];

      for (const segment of line.segments) {
        const segStart = chCount;
        const segEnd = segStart + segment.text.length;
        chCount = segEnd;

        // No overlap
        if (segEnd <= startCh || segStart >= endCh) {
          newSegments.push(segment);
          continue;
        }

        // Full overlap
        if (segStart >= startCh && segEnd <= endCh) {
          newSegments.push({ ...segment, [style]: !segment[style] });
          continue;
        }

        // Partial overlap
        const before = segment.text.slice(0, Math.max(0, startCh - segStart));
        const middle = segment.text.slice(
          Math.max(0, startCh - segStart),
          endCh - segStart
        );
        const after = segment.text.slice(endCh - segStart);

        if (before) newSegments.push({ ...segment, text: before });
        if (middle)
          newSegments.push({
            ...segment,
            text: middle,
            [style]: !segment[style],
          });
        if (after) newSegments.push({ ...segment, text: after });
      }

      line.segments = newSegments;
      this._mergeSegments(i);
    }
  }
}
