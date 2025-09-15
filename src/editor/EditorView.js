import { createSearchWidget } from "../components/SearchWidget/SearchWidget,js";

class NaiveLayoutManager {
  static DPI = 96;
  static PAGE_CONTENT_HEIGHT_PX = 9 * NaiveLayoutManager.DPI; // 9"
  static PAGE_BREAK_HEIGHT_PX = 2 * NaiveLayoutManager.DPI; // 2"

  constructor(getLineHeightFn, getNumLinesFn) {
    this.getLineHeight = getLineHeightFn;
    this.getNumLines = getNumLinesFn;
  }

  getPageLineRanges() {
    const pageLineRanges = [];
    let currentLine = 0;
    const numLines = this.getNumLines();

    while (currentLine < numLines) {
      const startLine = currentLine;
      let accumulatedHeight = 0;
      let line = currentLine;

      while (line < numLines) {
        const h = this.getLineHeight(line);
        if (
          accumulatedHeight + h > NaiveLayoutManager.PAGE_CONTENT_HEIGHT_PX &&
          accumulatedHeight > 0
        ) {
          break;
        }
        accumulatedHeight += h;
        line++;
        if (
          h > NaiveLayoutManager.PAGE_CONTENT_HEIGHT_PX &&
          accumulatedHeight > 0
        ) {
          break;
        }
      }
      const endLine = Math.max(startLine, line - 1);
      pageLineRanges.push({
        startLine,
        endLine,
        contentHeight: accumulatedHeight,
      });
      currentLine = line;
    }
    return pageLineRanges;
  }
}

export class EditorView {
  constructor(model, container, widgetLayer) {
    this.model = model;
    this.container = container;
    this.widgetLayer = widgetLayer;

    this.CHARS_PER_ROW = 60; // screenplay standard
    const BASE_LINE_HEIGHT =
      parseInt(getComputedStyle(this.container).lineHeight, 10) || 20;
    this.BASE_LINE_HEIGHT = BASE_LINE_HEIGHT;

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
      return rows * this.BASE_LINE_HEIGHT;
    };

    this.getLineWrappedRows = (lineIndex) => {
      const lineText = this._getLineText(lineIndex);
      return this._computeWrappedRows(lineText);
    };

    this.layoutManager = new NaiveLayoutManager(
      this.getLineHeight,
      () => this.model.lines.length
    );

    this.searchWidget = createSearchWidget();
    this.widgetLayer.appendChild(this.searchWidget);
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    this.matchesByLine = new Map();

    this.cursorEl = document.createElement("div");
    this.cursorEl.className = "cursor";
    this.cursorEl.style.position = "absolute";
    this.cursorEl.style.zIndex = "1";

    this.cursorBlinkInterval = null;
    this.cursorBlinkTimeout = null;
    this.startBlink();

    this.container.addEventListener("scroll", () => {
      requestAnimationFrame(() => this.render());
    });
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
    // clamp ch to valid range [0, totalLength]
    const total = rows.reduce((s, r) => s + r.length, 0);
    ch = Math.max(0, Math.min(ch, total));

    let remaining = ch;
    for (let i = 0; i < rows.length; i++) {
      // STRICT comparison: if remaining is strictly inside this row, return it.
      if (remaining < rows[i].length) {
        return { rowIndex: i, colInRow: remaining };
      }
      // else remaining is at or beyond this row -> subtract and continue
      remaining -= rows[i].length;
    }

    // If ch === total (cursor at end of line), return end position on last row
    const last = rows.length - 1;
    return {
      rowIndex: last,
      colInRow: rows[last].length,
    };
  }
  getChFromRowPosition(lineIndex, rowIndex, colInRow) {
    const rows = this.getWrappedRows(lineIndex);
    rowIndex = Math.max(0, Math.min(rowIndex, rows.length - 1));

    // If target row is NOT the last wrapped row, disallow returning the boundary
    // index equal to rows[rowIndex].length (which maps to next row start).
    let maxCol = rows[rowIndex].length;
    if (rowIndex < rows.length - 1) {
      // ensure non-negative (in case a wrapped row is empty)
      maxCol = Math.max(0, rows[rowIndex].length - 1);
    }

    const col = Math.max(0, Math.min(colInRow, maxCol));

    // sum lengths of rows before rowIndex
    let ch = 0;
    for (let i = 0; i < rowIndex; i++) ch += rows[i].length;
    return ch + col;
  }

  render() {
    const scrollTop = this.container.scrollTop;
    const clientHeight = this.container.clientHeight;

    const pageLineRanges = this.layoutManager.getPageLineRanges();
    if (pageLineRanges.length === 0) {
      this.container.innerHTML = "";
      this.container.appendChild(this.cursorEl);
      this.updateCursor();
      return;
    }

    const pageContentHeight = NaiveLayoutManager.PAGE_CONTENT_HEIGHT_PX;
    const pageBreakHeight = NaiveLayoutManager.PAGE_BREAK_HEIGHT_PX;
    const pageSlotHeight = pageContentHeight + pageBreakHeight;

    // 1. Calculate page tops and total height
    const pageMetrics = [];
    let accumulatedHeight = 0;
    for (let i = 0; i < pageLineRanges.length; i++) {
      const page = pageLineRanges[i];
      const isLastPage = i === pageLineRanges.length - 1;
      const height = isLastPage ? page.contentHeight : pageSlotHeight;
      pageMetrics.push({
        top: accumulatedHeight,
        height: height,
        page: page,
        index: i,
      });
      accumulatedHeight += height;
    }
    const totalHeight = accumulatedHeight;

    // 2. Find visible pages
    const visiblePages = pageMetrics.filter(
      (p) => p.top < scrollTop + clientHeight && p.top + p.height > scrollTop
    );

    // 3. Render
    this.container.innerHTML = "";
    this.container.appendChild(this.cursorEl);

    const topSpacerHeight = visiblePages.length > 0 ? visiblePages[0].top : 0;
    const topSpacer = document.createElement("div");
    topSpacer.style.height = `${topSpacerHeight}px`;
    this.container.appendChild(topSpacer);

    for (const p of visiblePages) {
      const pageContainer = document.createElement("div");
      for (let j = p.page.startLine; j <= p.page.endLine; j++) {
        const lineEl = this._renderLine(j);
        lineEl.dataset.line = j;
        pageContainer.appendChild(lineEl);
      }

      const isLastPage = p.index === pageLineRanges.length - 1;
      if (!isLastPage) {
        if (p.page.contentHeight < pageContentHeight) {
          const spacer = document.createElement("div");
          spacer.style.height = `${pageContentHeight - p.page.contentHeight}px`;
          pageContainer.appendChild(spacer);
        }
        const breakEl = this._createPageBreak();
        breakEl.style.height = `${pageBreakHeight}px`;
        pageContainer.appendChild(breakEl);
      }
      this.container.appendChild(pageContainer);
    }

    const lastVisiblePage = visiblePages[visiblePages.length - 1];
    const bottomSpacerHeight = lastVisiblePage
      ? totalHeight - (lastVisiblePage.top + lastVisiblePage.height)
      : totalHeight;
    const bottomSpacer = document.createElement("div");
    bottomSpacer.style.height = `${Math.max(0, bottomSpacerHeight)}px`;
    this.container.appendChild(bottomSpacer);

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

    const lineText = this._getLineText(lineIndex);
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
      if (event.open) activeClasses.push(event.type);
      else activeClasses = activeClasses.filter((c) => c !== event.type);
      lastPos = event.pos;
    }
    flush(lastPos, lineText.length);

    return lineEl;
  }

  updateCursor() {
    const { line, ch } = this.model.cursor;
    const lineEl = this.container.querySelector(`[data-line="${line}"]`);

    if (!lineEl) {
      this.cursorEl.style.display = "none";
      return;
    }
    this.cursorEl.style.display = "block";

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
        const emptyNode = document.createTextNode("\u200B");
        lineEl.appendChild(emptyNode);
        targetNode = emptyNode;
        offset = 0;
      }
    }

    const range = document.createRange();
    range.setStart(targetNode, offset);
    range.setEnd(targetNode, offset);
    const rects = range.getClientRects();
    if (rects.length > 0) {
      const rect = rects[rects.length - 1];
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

  highlightMatches(matches, currentIndex) {
    this.searchMatches = matches;
    this.currentMatchIndex = currentIndex;

    this.matchesByLine = new Map();
    for (const match of matches) {
      if (!this.matchesByLine.has(match.line)) {
        this.matchesByLine.set(match.line, []);
      }
      this.matchesByLine.get(match.line).push(match);
    }

    this.render();
  }

  clearHighlights() {
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    this.matchesByLine = new Map();
    this.render();
  }

  scrollToLine(lineNumber) {
    const pageLineRanges = this.layoutManager.getPageLineRanges();
    let targetPage = -1;
    for (let i = 0; i < pageLineRanges.length; i++) {
      if (
        lineNumber >= pageLineRanges[i].startLine &&
        lineNumber <= pageLineRanges[i].endLine
      ) {
        targetPage = i;
        break;
      }
    }

    if (targetPage !== -1) {
      let height = 0;
      for (let i = 0; i < targetPage; i++) {
        height +=
          pageLineRanges[i].contentHeight +
          NaiveLayoutManager.PAGE_BREAK_HEIGHT_PX;
      }
      this.container.scrollTop = height;
    }
  }
}
