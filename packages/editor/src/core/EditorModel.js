export class EditorModel {
  constructor(text = "") {
    this.lines = [];
    this.setText(text);
    this.cursor = { line: 0, ch: 0 };
    this.selection = null; // {start:{line,ch}, end:{line,ch}}
  }

  getCursorPos() {
    return { ...this.cursor };
  }

  getSelectionRange() {
    if (this.selection) {
      return this.normalizeRange(this.selection);
    }
    return null;
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
      0,
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
      (seg) => seg.text.length > 0,
    );
  }

  insertChar(char, pos) {
    console.log("[EditorModel] insertChar", char, "at", pos);

    const { line, ch } = pos;

    if (line < 0 || line >= this.lines.length) {
      console.warn(`Attempted to insert character at invalid line: ${line}`);
      return;
    }
    if (this.lines[line].segments.length === 0) {
      this.lines[line].segments.push({
        text: "",
        bold: false,
        italic: false,
        underline: false,
      });
    }

    const { segment, offset } = this._findSegmentAt(line, ch);

    // Insert character into the segment's text
    segment.text =
      segment.text.slice(0, offset) + char + segment.text.slice(offset);
  }

  deleteChar(pos) {
    console.log("[EditorModel] deleteChar at", pos);
    const { line, ch } = pos;

    if (ch === 0 && line > 0) {
      // Merging with the previous line
      const prevLineLength = this.getLineLength(line - 1);
      const currentLine = this.lines[line];

      // Append current line's segments to the previous line
      this.lines[line - 1].segments.push(...currentLine.segments);
      this.lines.splice(line, 1); // Remove the current line

      this._mergeSegments(line - 1); // Merge segments after joining lines

      return "\n"; // Return newline to indicate a line merge
    } else if (ch > 0) {
      const { segment, offset } = this._findSegmentAt(line, ch);
      const deletedChar = segment.text[offset - 1];
      segment.text =
        segment.text.slice(0, offset - 1) + segment.text.slice(offset);
      this._mergeSegments(line);
      return deletedChar;
    }
    return null; // Nothing was deleted
  }

  insertNewLine(pos) {
    console.log("[EditorModel] insertNewLine at", pos);
    const { line, ch } = pos;
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
  }

  setSelection(start, end) {
    this.selection = { start, end };
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

  getSelectedText(selectionRange) {
    let text = this.getTextInRange(selectionRange);
    return text;
  }

  getTextInRange(range) {
    const { start, end } = this.normalizeRange(range);
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

  getRichTextInRange(range) {
    const { start, end } = this.normalizeRange(range);
    const richText = [];

    for (let i = start.line; i <= end.line; i++) {
      const line = this.lines[i];
      const startCh = i === start.line ? start.ch : 0;
      const endCh = i === end.line ? end.ch : this.getLineLength(i);

      let chCount = 0;
      const segments = [];
      for (const segment of line.segments) {
        const segStart = chCount;
        const segEnd = segStart + segment.text.length;

        if (segEnd > startCh && segStart < endCh) {
          const text = segment.text.slice(
            Math.max(0, startCh - segStart),
            Math.min(segment.text.length, endCh - segStart),
          );
          segments.push({ ...segment, text });
        }
        chCount = segEnd;
      }
      richText.push({ ...line, segments });
    }
    return richText;
  }

  normalizeSelection(selection) {
    const { start, end } = selection;
    if (
      start.line < end.line ||
      (start.line === end.line && start.ch <= end.ch)
    ) {
      return { start: { ...start }, end: { ...end } };
    }
    return { start: { ...end }, end: { ...start } };
  }
  normalizeRange(range) {
    const { start, end } = range;

    if (
      start.line < end.line ||
      (start.line === end.line && start.ch <= end.ch)
    ) {
      return { start: { ...start }, end: { ...end } };
    }
    return { start: { ...end }, end: { ...start } };
  }

  insertText(text, pos) {
    this.insertRichText(
      text.split("\n").map((lineText) => ({
        type: "action",
        segments: [
          { text: lineText, bold: false, italic: false, underline: false },
        ],
      })),
      pos,
    );
  }

  insertRichText(richText, pos) {
    const { line, ch } = pos;

    if (richText.length === 1) {
      // Single line insert
      const { segment, segmentIndex, offset } = this._findSegmentAt(line, ch);
      const lineObj = this.lines[line];
      const incomingSegments = richText[0].segments;

      const textBefore = segment.text.slice(0, offset);
      const textAfter = segment.text.slice(offset);

      const newSegments = [];
      // Segments before the insertion point
      newSegments.push(...lineObj.segments.slice(0, segmentIndex));
      // Part of the split segment before insertion
      if (textBefore) {
        newSegments.push({ ...segment, text: textBefore });
      }
      // The new segments being inserted
      newSegments.push(...incomingSegments);
      // Part of the split segment after insertion
      if (textAfter) {
        newSegments.push({ ...segment, text: textAfter });
      }
      // Segments after the insertion point
      newSegments.push(...lineObj.segments.slice(segmentIndex + 1));

      lineObj.segments = newSegments;

      const insertedTextLength = incomingSegments.reduce(
        (sum, s) => sum + s.text.length,
        0,
      );
      this.cursor.ch += insertedTextLength;
      this._mergeSegments(line);
    } else {
      // Multi-line insert
      const { segment, segmentIndex, offset } = this._findSegmentAt(line, ch);
      const lineObj = this.lines[line];

      // 1. Define what to keep from the original line
      const textBeforeInsertion = segment.text.slice(0, offset);
      const textAfterInsertion = segment.text.slice(offset);

      const segmentsBefore = lineObj.segments.slice(0, segmentIndex);
      if (textBeforeInsertion) {
        segmentsBefore.push({ ...segment, text: textBeforeInsertion });
      }

      const segmentsAfter = [];
      if (textAfterInsertion) {
        segmentsAfter.push({ ...segment, text: textAfterInsertion });
      }
      segmentsAfter.push(...lineObj.segments.slice(segmentIndex + 1));

      // 2. The first line of insertion becomes the end of the original line
      lineObj.segments = [...segmentsBefore, ...richText[0].segments];
      this._mergeSegments(line);

      // 3. Middle lines are inserted as is
      const newLines = richText
        .slice(1, richText.length - 1)
        .map((lineData) => ({
          type: lineData.type,
          segments: lineData.segments,
        }));

      // 4. The last line of insertion is prepended to the segments that were after the cursor
      const lastRichTextLine = richText[richText.length - 1];
      const lastNewLine = {
        type: lastRichTextLine.type,
        segments: [...lastRichTextLine.segments, ...segmentsAfter],
      };
      newLines.push(lastNewLine);

      // 5. Insert the new lines
      this.lines.splice(line + 1, 0, ...newLines);

      this.cursor.line += newLines.length;
      const lastLineLength = this.getLineLength(this.cursor.line);
      const segmentsAfterLength = segmentsAfter.reduce(
        (l, s) => l + s.text.length,
        0,
      );
      this.cursor.ch = lastLineLength - segmentsAfterLength;
    }
  }

  deleteText(range) {
    if (!range) return;
    const deletedRichText = this.getRichTextInRange(range);
    const { start, end } = this.normalizeRange(range);

    const {
      segment: startSegment,
      segmentIndex: startSegmentIndex,
      offset: startOffset,
    } = this._findSegmentAt(start.line, start.ch);
    const {
      segment: endSegment,
      segmentIndex: endSegmentIndex,
      offset: endOffset,
    } = this._findSegmentAt(end.line, end.ch);

    // Part of the start line to keep
    const startLineSegments = this.lines[start.line].segments.slice(
      0,
      startSegmentIndex,
    );
    const truncatedStart = {
      ...startSegment,
      text: startSegment.text.slice(0, startOffset),
    };
    if (truncatedStart.text) {
      startLineSegments.push(truncatedStart);
    }

    // Part of the end line to keep
    const endLineSegments = [];
    const truncatedEnd = {
      ...endSegment,
      text: endSegment.text.slice(endOffset),
    };
    if (truncatedEnd.text) {
      endLineSegments.push(truncatedEnd);
    }
    endLineSegments.push(
      ...this.lines[end.line].segments.slice(endSegmentIndex + 1),
    );

    // Replace the start line with the merged content
    this.lines[start.line].segments = [
      ...startLineSegments,
      ...endLineSegments,
    ];

    // Remove the lines in between
    if (start.line < end.line) {
      this.lines.splice(start.line + 1, end.line - start.line);
    }

    this._mergeSegments(start.line);
    return deletedRichText;
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
      const { start } = this.normalizeSelection(this.selection);
      this.updateCursor({ line: start.line, ch: start.ch });
      this.clearSelection();
    }
  }

  moveCursorToSelectionEnd() {
    if (this.hasSelection()) {
      const { end } = this.normalizeSelection(this.selection);
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

  toggleInlineStyle(style, range) {
    range = this.normalizeRange(range);
    if (!range) return;

    const { start, end } = range;

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
          endCh - segStart,
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
