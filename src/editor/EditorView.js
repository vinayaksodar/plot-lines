import { createSearchWidget } from "../components/SearchWidget/SearchWidget,js";

// NOTE: In a larger application, this class would be in its own file
// to better separate concerns (e.g., 'src/editor/layout/IncrementalScanLayout.js').
class IncrementalScanApproach {
  // Page Break Constants, using standard paper sizes.
  static DPI = 96; // Standard screen DPI
  static PAGE_CONTENT_HEIGHT_PX = 9 * IncrementalScanApproach.DPI; // 9 inches of content
  static PAGE_BREAK_HEIGHT_PX = 2 * IncrementalScanApproach.DPI; // 2 inches for top/bottom margins

  constructor(getLineHeightFn, numLines) {
    this.getLineHeight = getLineHeightFn;
    this.numLines = numLines;
  }

  // Note: No 'build' step is needed for this simple approach.

  updateLineHeight(/* index, newHeight */) {
    // This method is a no-op because this layout manager is designed to be
    // stateless. It relies on the `getLineHeight` function, which reads
    // directly from the model, ensuring it always has the latest data without
    // needing to maintain its own height cache.
  }

  // Calculates the total height of content from the beginning to a specific line.
  // O(n) operation.
  getContentHeightAtLine(index) {
    if (index < 0) return 0;
    let contentHeight = 0;
    for (let i = 0; i <= index; i++) {
      contentHeight += this.getLineHeight(i);
    }
    return contentHeight;
  }

  // Calculates the total height including page breaks up to a specific line.
  // O(n) operation.
  getTotalHeightAtLine(index) {
    if (index < 0) return 0;
    const contentHeight = this.getContentHeightAtLine(index);
    const numBreaks = Math.floor(
      contentHeight / IncrementalScanApproach.PAGE_CONTENT_HEIGHT_PX
    );
    return (
      contentHeight + numBreaks * IncrementalScanApproach.PAGE_BREAK_HEIGHT_PX
    );
  }

  // Finds the line index that corresponds to a given vertical pixel offset.
  // This is the performance bottleneck for large jumps (e.g., scrolling).
  // O(n) operation.
  findLineAtOffset(offset) {
    let contentHeight = 0;
    for (let i = 0; i < this.numLines; i++) {
      contentHeight += this.getLineHeight(i);
      const numBreaks = Math.floor(
        contentHeight / IncrementalScanApproach.PAGE_CONTENT_HEIGHT_PX
      );
      const totalHeight =
        contentHeight +
        numBreaks * IncrementalScanApproach.PAGE_BREAK_HEIGHT_PX;
      if (totalHeight >= offset) {
        return i;
      }
    }
    return this.numLines - 1;
  }
}

export class EditorView {
  constructor(model, container, widgetLayer) {
    this.model = model;
    this.container = container;
    this.widgetLayer = widgetLayer;

    this.CHARS_PER_ROW = 60; // Corresponds to screenplay standards
    const BASE_LINE_HEIGHT =
      parseInt(getComputedStyle(this.container).lineHeight, 10) || 20;

    this._getLineText = (lineIndex) => {
      if (lineIndex < 0 || lineIndex >= this.model.lines.length) return "";
      return this.model.lines[lineIndex].segments.map((s) => s.text).join("");
    };

    this._computeWrappedRows = (text) => {
      if (!text) return 1;
      const words = text.split(/(\s+)/);
      let rows = 1;
      let currentLen = 0;
      for (const word of words) {
        const wordLen = word.length;
        if (currentLen + wordLen <= this.CHARS_PER_ROW) {
          currentLen += wordLen;
        } else {
          if (wordLen > this.CHARS_PER_ROW) {
            const fullRows = Math.floor(wordLen / this.CHARS_PER_ROW);
            rows += fullRows;
            currentLen = wordLen % this.CHARS_PER_ROW;
          } else {
            rows++;
            currentLen = wordLen;
          }
        }
      }
      return rows;
    };

    this.getLineHeight = (lineIndex) => {
      const lineText = this._getLineText(lineIndex);
      const rows = this._computeWrappedRows(lineText);
      return rows * BASE_LINE_HEIGHT;
    };

    this.getLineWrappedRows = (lineIndex) => {
      const lineText = this._getLineText(lineIndex);
      return this._computeWrappedRows(lineText);
    };

    this.layoutManager = new IncrementalScanApproach(
      this.getLineHeight,
      this.model.lines.length
    );

    this.searchWidget = createSearchWidget();
    this.widgetLayer.appendChild(this.searchWidget);
    this.searchMatches = [];

    this.cursorEl = document.createElement("div");
    this.cursorEl.className = "cursor";
    container.appendChild(this.cursorEl);

    this.cursorBlinkInterval = null;
    this.cursorBlinkTimeout = null;
    this.startBlink();

    this.startLine = 0;
    this.endLine = 0;

    this.container.addEventListener("scroll", () => {
      requestAnimationFrame(() => this.render());
    });

    const totalHeight = this.layoutManager.getTotalHeightAtLine(
      this.model.lines.length - 1
    );
    const initialSpacer = document.createElement("div");
    initialSpacer.style.height = `${totalHeight}px`;
    this.container.appendChild(initialSpacer);
  }

  getWrappedRows(lineIndex) {
    const lineText = this._getLineText(lineIndex);
    const rows = [];
    let start = 0;
    while (start < lineText.length) {
      let end = Math.min(start + this.CHARS_PER_ROW, lineText.length);
      if (end < lineText.length && lineText[end] !== " ") {
        const lastSpace = lineText.lastIndexOf(" ", end);
        if (lastSpace > start) {
          end = lastSpace + 1;
        }
      }
      rows.push(lineText.slice(start, end));
      start = end;
    }
    return rows.length > 0 ? rows : [""];
  }

  getRowPosition(lineIndex, ch) {
    const rows = this.getWrappedRows(lineIndex);
    let remaining = ch;
    for (let i = 0; i < rows.length; i++) {
      if (remaining <= rows[i].length) {
        return { rowIndex: i, colInRow: remaining };
      }
      remaining -= rows[i].length;
    }
    return {
      rowIndex: rows.length - 1,
      colInRow: rows[rows.length - 1].length,
    };
  }

  getChFromRowPosition(lineIndex, rowIndex, colInRow) {
    const rows = this.getWrappedRows(lineIndex);
    let ch = 0;
    for (let i = 0; i < rowIndex; i++) {
      ch += rows[i].length;
    }
    return Math.min(ch + colInRow, this.model.getLineLength(lineIndex));
  }

  highlightMatches(ranges, currentIndex = -1) {
    this.searchMatches = ranges;
    this.currentMatchIndex = currentIndex;
    this.matchesByLine = new Map();
    for (const m of ranges) {
      if (!this.matchesByLine.has(m.line)) {
        this.matchesByLine.set(m.line, []);
      }
      this.matchesByLine.get(m.line).push(m);
    }
    this.render();
  }

  clearHighlights() {
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    this.matchesByLine = new Map();
    this.render();
  }

  /**
   * Renders the visible portion of the editor.
   * This function implements virtual scrolling by rendering only the lines
   * that are currently in or near the viewport. It uses spacers to ensure
   * the scrollbar accurately reflects the total document height.
   */
  render() {
    const scrollTop = this.container.scrollTop;
    const clientHeight = this.container.clientHeight;
    const buffer = 5; // Number of lines to render above and below the viewport

    const startLine = this.layoutManager.findLineAtOffset(scrollTop);

    let endLine = startLine;
    let renderedHeight = 0;
    while (renderedHeight < clientHeight && endLine < this.model.lines.length) {
      const lineTotalHeight =
        this.layoutManager.getTotalHeightAtLine(endLine) -
        this.layoutManager.getTotalHeightAtLine(endLine - 1);
      renderedHeight += lineTotalHeight;
      endLine++;
    }

    this.startLine = Math.max(0, startLine - buffer);
    this.endLine = Math.min(this.model.lines.length, endLine + buffer);

    this.container.innerHTML = ""; // Clear previous content
    this.container.appendChild(this.cursorEl);

    // Add a top spacer to simulate the height of all lines before the visible area
    const topSpacerHeight = this.layoutManager.getTotalHeightAtLine(
      this.startLine - 1
    );
    const beforeSpacer = document.createElement("div");
    beforeSpacer.style.height = `${topSpacerHeight}px`;
    this.container.appendChild(beforeSpacer);

    // Render the visible lines and any page breaks between them
    for (let i = this.startLine; i < this.endLine; i++) {
      const contentHeightBefore = this.layoutManager.getContentHeightAtLine(
        i - 1
      );
      const contentHeightAfter = this.layoutManager.getContentHeightAtLine(i);
      const pageNumBefore = Math.floor(
        contentHeightBefore / this.layoutManager.PAGE_CONTENT_HEIGHT_PX
      );
      const pageNumAfter = Math.floor(
        contentHeightAfter / this.layoutManager.PAGE_CONTENT_HEIGHT_PX
      );

      if (i > 0 && pageNumAfter > pageNumBefore) {
        this.container.appendChild(this._createPageBreak());
      }

      this.container.appendChild(this._renderLine(i));
    }

    // Add a bottom spacer for the remaining document height
    const totalHeight = this.layoutManager.getTotalHeightAtLine(
      this.model.lines.length - 1
    );
    const bottomSpacerHeight =
      totalHeight - this.layoutManager.getTotalHeightAtLine(this.endLine - 1);
    const afterSpacer = document.createElement("div");
    afterSpacer.style.height = `${bottomSpacerHeight}px`;
    this.container.appendChild(afterSpacer);

    this.updateCursor();
  }

  _createPageBreak() {
    const breakEl = document.createElement("div");
    breakEl.className = "page-break";
    const label = document.createElement("div");
    label.className = "page-break-label";
    label.textContent = "Page Break";
    breakEl.appendChild(label);
    return breakEl;
  }

  /**
   * Renders a single line of text, including styling, selections, and search highlights.
   * It uses an event-based system to correctly nest DOM nodes for overlapping styles.
   * @param {number} lineIndex The index of the line to render.
   * @returns {HTMLElement} The rendered line element.
   */
  _renderLine(lineIndex) {
    const lineObj = this.model.lines[lineIndex];
    const lineEl = document.createElement("div");
    lineEl.className = `line ${lineObj.type}`;

    const lineText = this._getLineText(lineIndex);
    if (lineText === "") {
      lineEl.appendChild(document.createTextNode("\u200B")); // Zero-width space for empty lines
      return lineEl;
    }

    const selection = this.model.hasSelection()
      ? this.model.normalizeSelection()
      : null;
    const lineMatches = this.matchesByLine?.get(lineIndex) || [];

    // Create a sorted list of events (style open/close, selection, search match)
    const events = [];
    let chCount = 0;
    for (const segment of lineObj.segments) {
      const segStart = chCount;
      const segEnd = segStart + segment.text.length;
      chCount = segEnd;
      if (segment.bold)
        events.push(
          { pos: segStart, type: "bold", open: true },
          { pos: segEnd, type: "bold", open: false }
        );
      if (segment.italic)
        events.push(
          { pos: segStart, type: "italic", open: true },
          { pos: segEnd, type: "italic", open: false }
        );
      if (segment.underline)
        events.push(
          { pos: segStart, type: "underline", open: true },
          { pos: segEnd, type: "underline", open: false }
        );
    }

    if (
      selection &&
      lineIndex >= selection.start.line &&
      lineIndex <= selection.end.line
    ) {
      const selStart =
        lineIndex === selection.start.line ? selection.start.ch : 0;
      const selEnd =
        lineIndex === selection.end.line ? selection.end.ch : lineText.length;
      events.push(
        { pos: selStart, type: "selection", open: true },
        { pos: selEnd, type: "selection", open: false }
      );
    }

    for (const match of lineMatches) {
      const type =
        this.currentMatchIndex >= 0 &&
        this.searchMatches[this.currentMatchIndex] === match
          ? "search-match-current"
          : "search-match";
      events.push(
        { pos: match.start, type, open: true },
        { pos: match.end, type, open: false }
      );
    }

    events.sort((a, b) => a.pos - b.pos || (a.open ? 1 : -1));

    // Process events and create styled spans
    let activeClasses = [];
    let lastPos = 0;
    const flush = (from, to) => {
      if (from >= to) return;
      const text = lineText.slice(from, to);
      const span = document.createElement("span");
      if (activeClasses.length) span.className = activeClasses.join(" ");
      span.textContent = text;
      lineEl.appendChild(span);
    };

    for (const event of events) {
      flush(lastPos, event.pos);
      if (event.open) {
        activeClasses.push(event.type);
      } else {
        activeClasses = activeClasses.filter((c) => c !== event.type);
      }
      lastPos = event.pos;
    }
    flush(lastPos, lineText.length);

    return lineEl;
  }

  /**
   * Updates the position and visibility of the cursor element.
   * This is a complex operation that involves finding the precise pixel
   * position of the cursor within potentially wrapped lines of text.
   */
  updateCursor() {
    const { line, ch } = this.model.cursor;

    if (line < this.startLine || line >= this.endLine) {
      this.cursorEl.style.display = "none";
      return;
    }
    this.cursorEl.style.display = "block";

    // Find the correct DOM element for the cursor's line, accounting for page breaks.
    // This is brittle; a data-attribute on line elements would be more robust.
    let elementCount = 1; // Start at 1 to skip the top spacer
    let targetEl = null;
    for (let i = this.startLine; i <= line; i++) {
      const contentHeightBefore = this.layoutManager.getContentHeightAtLine(
        i - 1
      );
      const contentHeightAfter = this.layoutManager.getContentHeightAtLine(i);
      const pageNumBefore = Math.floor(
        contentHeightBefore / this.layoutManager.PAGE_CONTENT_HEIGHT_PX
      );
      const pageNumAfter = Math.floor(
        contentHeightAfter / this.layoutManager.PAGE_CONTENT_HEIGHT_PX
      );

      if (i > this.startLine && pageNumAfter > pageNumBefore) {
        elementCount++;
      }
      if (i === line) {
        targetEl = this.container.children[elementCount + 1]; // +1 for cursor element
      }
      elementCount++;
    }

    if (!targetEl) return;

    // Walk through the text nodes of the line element to find the cursor's character offset.
    const walker = document.createTreeWalker(
      targetEl,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let remaining = ch;
    let targetNode = null;
    let offset = 0;

    while (walker.nextNode()) {
      const len = walker.currentNode.textContent.length;
      if (remaining <= len) {
        targetNode = walker.currentNode;
        offset = remaining;
        break;
      }
      remaining -= len;
    }

    if (!targetNode) {
      // Fallback for end of line or empty lines
      if (
        targetEl.lastChild &&
        targetEl.lastChild.nodeType === Node.TEXT_NODE
      ) {
        targetNode = targetEl.lastChild;
        offset = targetEl.lastChild.textContent.length;
      } else {
        const emptyNode = document.createTextNode("\u200B");
        targetEl.appendChild(emptyNode);
        targetNode = emptyNode;
        offset = 0;
      }
    }

    // Use a Range to get the client rectangle for the cursor position.
    const range = document.createRange();
    range.setStart(targetNode, offset);
    range.setEnd(targetNode, offset);
    const rects = range.getClientRects();

    if (rects.length > 0) {
      const rect = rects[rects.length - 1]; // Use the last rect for multi-line wraps
      const containerRect = this.container.getBoundingClientRect();
      this.cursorEl.style.top = `${
        rect.top - containerRect.top + this.container.scrollTop
      }px`;
      this.cursorEl.style.left = `${
        rect.left - containerRect.left + this.container.scrollLeft
      }px`;
      this.cursorEl.style.height = `${rect.height}px`;
    }

    this.pauseBlinkAndRestart();
  }

  startBlink() {
    if (this.cursorBlinkInterval) clearInterval(this.cursorBlinkInterval);
    this.cursorEl.style.visibility = "visible";
    this.cursorBlinkInterval = setInterval(() => {
      this.cursorEl.style.visibility =
        this.cursorEl.style.visibility === "hidden" ? "visible" : "hidden";
    }, 530);
  }

  pauseBlinkAndRestart() {
    if (this.cursorBlinkInterval) {
      clearInterval(this.cursorBlinkInterval);
      this.cursorBlinkInterval = null;
    }
    this.cursorEl.style.visibility = "visible";
    if (this.cursorBlinkTimeout) clearTimeout(this.cursorBlinkTimeout);
    this.cursorBlinkTimeout = setTimeout(() => this.startBlink(), 530);
  }

  showSearchWidget() {
    this.searchWidget.classList.remove("hidden");
    const input = this.searchWidget.querySelector(".search-input");
    input.focus();
    input.select();
  }

  hideSearchWidget() {
    this.searchWidget.classList.add("hidden");
  }

  scrollToLine(lineNumber) {
    const targetScrollTop = this.layoutManager.getTotalHeightAtLine(
      lineNumber - 1
    );
    const clientHeight = this.container.clientHeight;
    const lineBottom = this.layoutManager.getTotalHeightAtLine(lineNumber);

    const viewportTop = this.container.scrollTop;
    const viewportBottom = viewportTop + clientHeight;

    if (targetScrollTop >= viewportTop && lineBottom <= viewportBottom) {
      return; // Already visible
    }

    // Center the line in the viewport
    const lineHeight = lineBottom - targetScrollTop;
    const centeredScrollTop = Math.max(
      0,
      targetScrollTop - clientHeight / 2 + lineHeight / 2
    );
    this.container.scrollTop = centeredScrollTop;
  }
}
