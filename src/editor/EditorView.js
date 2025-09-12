import { createSearchWidget } from "../components/SearchWidget/SearchWidget,js";

// The Incremental Scan layout manager is now included here.
// In a real app, this would be in its own file.
class IncrementalScanApproach {
  constructor(getLineHeightFn, numLines) {
    this.getLineHeight = getLineHeightFn;
    this.numLines = numLines;

    // Page Break Constants
    this.DPI = 96;
    this.PAGE_CONTENT_HEIGHT_PX = 9 * this.DPI;
    this.PAGE_BREAK_HEIGHT_PX = 2 * this.DPI;
  }

  // Note: No 'build' step is needed for this approach.

  updateLineHeight(index, newHeight) {
    // In a real implementation, you'd update an internal heights array.
    // For this demo, we rely on the getLineHeight function which reads
    // from the main document model, so this method can be a no-op.
  }

  // O(n) operation
  getContentHeightAtLine(index) {
    if (index < 0) return 0;
    let contentHeight = 0;
    for (let i = 0; i <= index; i++) {
      contentHeight += this.getLineHeight(i);
    }
    return contentHeight;
  }

  // O(n) operation
  getTotalHeightAtLine(index) {
    if (index < 0) return 0;
    const contentHeight = this.getContentHeightAtLine(index);
    const numBreaks = Math.floor(contentHeight / this.PAGE_CONTENT_HEIGHT_PX);
    return contentHeight + numBreaks * this.PAGE_BREAK_HEIGHT_PX;
  }

  // O(n) operation - THE BOTTLENECK FOR LARGE JUMPS
  findLineAtOffset(offset) {
    let contentHeight = 0;
    for (let i = 0; i < this.numLines; i++) {
      contentHeight += this.getLineHeight(i);
      const numBreaks = Math.floor(contentHeight / this.PAGE_CONTENT_HEIGHT_PX);
      const totalHeight = contentHeight + numBreaks * this.PAGE_BREAK_HEIGHT_PX;
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

    // --- NEW: Line height calculation logic ---
    this.CHARS_PER_ROW = 60;
    const BASE_LINE_HEIGHT =
      parseInt(getComputedStyle(this.container).lineHeight, 10) || 20;

    // --- Helper: compute wrapped rows with word wrapping ---
    this._computeWrappedRows = (text) => {
      if (!text) return 1;

      const words = text.split(/(\s+)/); // keep spaces
      let rows = 1;
      let currentLen = 0;

      for (const word of words) {
        const wordLen = word.length;

        if (currentLen + wordLen <= this.CHARS_PER_ROW) {
          currentLen += wordLen;
        } else {
          // if word itself longer than row, break across multiple rows
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
      const lineText = this.model.lines[lineIndex].segments
        .map((s) => s.text)
        .join("");
      const rows = this._computeWrappedRows(lineText);
      return rows * BASE_LINE_HEIGHT;
    };

    this.getLineWrappedRows = (lineIndex) => {
      const lineText = this.model.lines[lineIndex].segments
        .map((s) => s.text)
        .join("");
      return this._computeWrappedRows(lineText);
    };

    // --- NEW: Instantiate the layout manager ---
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
      requestAnimationFrame(() => {
        this.render();
      });
    });

    // Initial render requires setting the total height for the scrollbar
    const totalHeight = this.layoutManager.getTotalHeightAtLine(
      this.model.lines.length - 1
    );
    const initialSpacer = document.createElement("div");
    initialSpacer.style.height = `${totalHeight}px`;
    this.container.appendChild(initialSpacer);
  }

  // Returns an array of wrapped row strings for a line
  getWrappedRows(lineIndex) {
    const lineText = this.model.lines[lineIndex].segments
      .map((s) => s.text)
      .join("");

    const rows = [];
    let start = 0;

    while (start < lineText.length) {
      let end = Math.min(start + this.CHARS_PER_ROW, lineText.length);

      // If we didn't land at whitespace and not at end, backtrack to last space
      if (end < lineText.length && lineText[end] !== " ") {
        const lastSpace = lineText.lastIndexOf(" ", end);
        if (lastSpace > start) {
          end = lastSpace + 1; // keep the space in the row
        }
      }

      rows.push(lineText.slice(start, end));
      start = end;
    }

    return rows.length > 0 ? rows : [""];
  }

  // Map (line, ch) → { rowIndex, colInRow }
  getRowPosition(lineIndex, ch) {
    const rows = this.getWrappedRows(lineIndex);

    let remaining = ch;
    for (let i = 0; i < rows.length; i++) {
      if (remaining <= rows[i].length) {
        return { rowIndex: i, colInRow: remaining };
      }
      remaining -= rows[i].length;
    }
    // fallback (end of line)
    return {
      rowIndex: rows.length - 1,
      colInRow: rows[rows.length - 1].length,
    };
  }

  // Map (rowIndex, colInRow) → ch
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

  render() {
    const scrollTop = this.container.scrollTop;
    const clientHeight = this.container.clientHeight;
    const buffer = 5;

    // --- REFACTORED: Use layout manager for all calculations ---
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

    this.container.innerHTML = ""; // Clear container
    this.container.appendChild(this.cursorEl);

    const topSpacerHeight = this.layoutManager.getTotalHeightAtLine(
      this.startLine - 1
    );
    const beforeSpacer = document.createElement("div");
    beforeSpacer.style.height = `${topSpacerHeight}px`;
    this.container.appendChild(beforeSpacer);

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
        const pageBreak = this._createPageBreak();
        this.container.appendChild(pageBreak);
      }

      const lineEl = this._renderLine(i);
      this.container.appendChild(lineEl);
    }

    const totalHeight = this.layoutManager.getTotalHeightAtLine(
      this.model.lines.length - 1
    );
    const bottomSpacerHeight =
      totalHeight - this.layoutManager.getTotalHeightAtLine(this.endLine - 1);
    const afterSpacer = document.createElement("div");
    afterSpacer.style.height = `${bottomSpacerHeight}px`;
    this.container.appendChild(afterSpacer);

    // Line numbers would also need refactoring to handle variable heights if enabled
    // if (this.lineNumbers) { ... }

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

  _renderLine(lineIndex) {
    const lineObj = this.model.lines[lineIndex];
    const lineEl = document.createElement("div");

    lineEl.className = `line ${lineObj.type}`;

    const lineText = lineObj.segments.map((s) => s.text).join("");
    if (lineText === "") {
      lineEl.appendChild(document.createTextNode("\u200B"));
      return lineEl;
    }

    const selection = this.model.hasSelection()
      ? this.model.normalizeSelection()
      : null;
    const lineMatches = this.matchesByLine?.get(lineIndex) || [];

    const events = [];

    let chCount = 0;
    for (const segment of lineObj.segments) {
      const segStart = chCount;
      const segEnd = segStart + segment.text.length;
      chCount = segEnd;

      if (segment.bold) {
        events.push({ pos: segStart, type: "bold", open: true });
        events.push({ pos: segEnd, type: "bold", open: false });
      }
      if (segment.italic) {
        events.push({ pos: segStart, type: "italic", open: true });
        events.push({ pos: segEnd, type: "italic", open: false });
      }
      if (segment.underline) {
        events.push({ pos: segStart, type: "underline", open: true });
        events.push({ pos: segEnd, type: "underline", open: false });
      }
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
      events.push({ pos: selStart, type: "selection", open: true });
      events.push({ pos: selEnd, type: "selection", open: false });
    }

    for (const match of lineMatches) {
      const type =
        this.currentMatchIndex >= 0 &&
        this.searchMatches[this.currentMatchIndex] === match
          ? "search-match-current"
          : "search-match";
      events.push({ pos: match.start, type, open: true });
      events.push({ pos: match.end, type, open: false });
    }

    events.sort((a, b) => a.pos - b.pos || (a.open ? 1 : -1));

    let activeClasses = [];
    let lastPos = 0;

    const flush = (from, to) => {
      if (from >= to) return;
      const text = lineText.slice(from, to);
      const span = document.createElement("span");
      if (activeClasses.length) {
        span.className = activeClasses.join(" ");
      }
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

  updateCursor() {
    const { line, ch } = this.model.cursor;

    if (line < this.startLine || line >= this.endLine) {
      this.cursorEl.style.display = "none";
      return;
    } else {
      this.cursorEl.style.display = "block";
    }

    // --- REFACTORED: Find the correct DOM element, accounting for page breaks ---
    let elementCount = 1; // Start at 1 to skip the top spacer
    let targetEl = null;
    for (let i = this.startLine; i <= line; i++) {
      // Check for a page break before this line
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
    const lineEl = targetEl;

    const walker = document.createTreeWalker(
      lineEl,
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
      if (lineEl.lastChild && lineEl.lastChild.nodeType === Node.TEXT_NODE) {
        targetNode = lineEl.lastChild;
        offset = lineEl.lastChild.textContent.length;
      } else {
        // Fallback for empty lines
        const firstChild = lineEl.firstChild;
        if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
          targetNode = firstChild;
          offset = 0;
        } else {
          const emptyNode = document.createTextNode("\u200B");
          lineEl.appendChild(emptyNode);
          targetNode = emptyNode;
          offset = 0;
        }
      }
    }

    const range = document.createRange();
    range.setStart(targetNode, offset);
    range.setEnd(targetNode, offset);

    const rects = range.getClientRects();
    if (rects.length > 0) {
      // rects is an array of DOMRects, one for each *wrapped row*
      const rect = rects[rects.length - 1];
      // pick correct one (usually last = visual row where caret sits)

      const containerRect = this.container.getBoundingClientRect();

      this.cursorEl.style.top =
        rect.top - containerRect.top + this.container.scrollTop + "px";
      this.cursorEl.style.left =
        rect.left - containerRect.left + this.container.scrollLeft + "px";
      this.cursorEl.style.height = rect.height + "px";
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
    // --- REFACTORED: Use the layout manager to find the correct scroll position ---
    const targetScrollTop = this.layoutManager.getTotalHeightAtLine(
      lineNumber - 1
    );
    const clientHeight = this.container.clientHeight;

    const currentScrollTop = this.container.scrollTop;
    const lineBottom = this.layoutManager.getTotalHeightAtLine(lineNumber);
    const viewportTop = currentScrollTop;
    const viewportBottom = currentScrollTop + clientHeight;

    // Check if the line is already fully visible
    if (targetScrollTop >= viewportTop && lineBottom <= viewportBottom) {
      return;
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
