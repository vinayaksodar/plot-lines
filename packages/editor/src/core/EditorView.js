import { createSearchWidget } from "../components/SearchWidget/SearchWidget.js";
class NaiveLayoutManager {
  static DPI = 96;
  static PAGE_CONTENT_HEIGHT_PX = 9 * NaiveLayoutManager.DPI; // 9"
  static PAGE_BREAK_HEIGHT_PX = 2 * NaiveLayoutManager.DPI; // 2"

  constructor(getLineHeightFn, getNumLinesFn, getTopSpacingFn, getLineTypeFn) {
    this.getLineHeight = getLineHeightFn;
    this.getNumLines = getNumLinesFn;
    this.getTopSpacing = getTopSpacingFn;
    this.getLineType = getLineTypeFn;
  }

  getOrphanGroup(page) {
    if (page.lines.length === 0) return null;

    const lastLine = page.lines[page.lines.length - 1];
    const lastIdx = lastLine.index;
    const lastType = this.getLineType(lastIdx);

    const remainingSpace =
      NaiveLayoutManager.PAGE_CONTENT_HEIGHT_PX - page.contentHeight;

    // --- Rule A: character + parenthetical must stay together
    if (
      lastType === "parenthetical" &&
      page.lines.length >= 2 &&
      this.getLineType(page.lines[page.lines.length - 2].index) === "character"
    ) {
      const required = this.getLineHeight(lastIdx);
      if (remainingSpace < required) {
        return [
          page.lines[page.lines.length - 2], // character
          lastLine, // parenthetical
        ];
      }
    }

    // --- Rule B: character rules
    if (lastType === "character") {
      const required = this.getLineHeight(lastIdx);
      if (remainingSpace < required) {
        return [lastLine];
      }

      // Special case: character + dialogue must stay together
      const nextIdx = lastIdx + 1;
      if (
        nextIdx < this.getNumLines() &&
        this.getLineType(nextIdx) === "dialogue"
      ) {
        const nextHeight = this.getLineHeight(nextIdx);
        if (remainingSpace < nextHeight) {
          return [lastLine]; // mark character as orphan → move with dialogue next page
        }
      }
    }

    // --- Rule C: scene-heading rules
    if (lastType === "scene-heading") {
      const required = 2 * this.getLineHeight(lastIdx);
      if (remainingSpace < required) {
        return [lastLine];
      }

      // Hard-coded exception: scene-heading + character
      const nextIdx = lastIdx + 1;
      if (
        nextIdx < this.getNumLines() &&
        this.getLineType(nextIdx) === "character"
      ) {
        const nextHeight = this.getLineHeight(nextIdx);
        if (remainingSpace < nextHeight) {
          return [lastLine]; // move heading so it stays with next char
        }
      }
    }

    return null;
  }

  /**
   * Returns an array of page objects:
   * [
   *   {
   *     startLine,
   *     endLine,
   *     contentHeight,    // sum of line heights + top spacings for that page
   *     lines: [ { index, topSpacing, height }, ... ]
   *   },
   *   ...
   * ]
   */
  getPageLineRanges() {
    const pageLineRanges = [];
    const numLines = this.getNumLines();
    let currentLine = 0;

    while (currentLine < numLines) {
      const startLine = currentLine;
      let accumulatedHeight = 0;
      let line = currentLine;

      const page = {
        startLine,
        endLine: startLine,
        contentHeight: 0,
        lines: [],
      };

      while (line < numLines) {
        const isFirstOnPage = line === startLine;
        const spacing = this.getTopSpacing
          ? this.getTopSpacing(line, isFirstOnPage)
          : 0;
        const baseHeight = this.getLineHeight(line);
        const h = spacing + baseHeight;

        if (
          accumulatedHeight + h > NaiveLayoutManager.PAGE_CONTENT_HEIGHT_PX &&
          accumulatedHeight > 0
        ) {
          break;
        }

        page.lines.push({ index: line, topSpacing: spacing, height: h });
        accumulatedHeight += h;
        page.endLine = line;

        line++;

        if (
          h > NaiveLayoutManager.PAGE_CONTENT_HEIGHT_PX &&
          accumulatedHeight > 0
        ) {
          break;
        }
      }

      page.contentHeight = accumulatedHeight;

      // --- Orphan fix ---
      const orphanGroup = this.getOrphanGroup(page);
      if (orphanGroup) {
        // Pop each line in group (from last to first)
        for (let i = orphanGroup.length - 1; i >= 0; i--) {
          const orphan = page.lines.pop();
          accumulatedHeight -= orphan.height;
        }

        // Update page end markers
        page.endLine =
          page.lines.length > 0
            ? page.lines[page.lines.length - 1].index
            : page.startLine;
        page.contentHeight = accumulatedHeight;

        // Put group back for next page
        line = orphanGroup[0].index;
      }

      pageLineRanges.push(page);

      currentLine = page.endLine + 1;
    }

    return pageLineRanges;
  }
}

export class EditorView {
  constructor(model, container, widgetLayer) {
    this.model = model;
    this.container = container;
    this.widgetLayer = widgetLayer;

    this.ELEMENT_CHARS_PER_ROW = {
      "scene-heading": 60,
      action: 60,
      character: 25,
      parenthetical: 20,
      dialogue: 40,
      transition: 15,
      shot: 60,
    };
    const BASE_LINE_HEIGHT =
      parseInt(getComputedStyle(this.container).lineHeight, 10) || 16;
    this.BASE_LINE_HEIGHT = BASE_LINE_HEIGHT;

    this._getLineText = (lineIndex) => {
      if (lineIndex < 0 || lineIndex >= this.model.lines.length) return "";
      return this.model.lines[lineIndex].segments.map((s) => s.text).join("");
    };

    this._getCharsPerRow = (lineIndex) => {
      const lineType = this.model.lines[lineIndex].type;
      return this.ELEMENT_CHARS_PER_ROW[lineType] || 60;
    };

    this._computeWrappedRows = (text, lineIndex) => {
      if (!text) return 1;
      const charsPerRow = this._getCharsPerRow(lineIndex);
      const words = text.split(/(\s+)/);
      let rows = 1;
      let currentLen = 0;
      for (const word of words) {
        const wordLen = word.length;
        if (currentLen + wordLen <= charsPerRow) {
          currentLen += wordLen;
        } else {
          if (wordLen > charsPerRow) {
            const fullRows = Math.floor(wordLen / charsPerRow);
            rows += fullRows;
            currentLen = wordLen % charsPerRow;
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
      const rows = this._computeWrappedRows(lineText, lineIndex);
      return rows * this.BASE_LINE_HEIGHT;
    };

    this.getLineWrappedRows = (lineIndex) => {
      const lineText = this._getLineText(lineIndex);
      return this._computeWrappedRows(lineText, lineIndex);
    };

    this.layoutManager = new NaiveLayoutManager(
      this.getLineHeight,
      () => this.model.lines.length,
      (lineIndex, isFirstOnPage) =>
        this.getTopSpacing(lineIndex, isFirstOnPage),
      (lineIndex) => this.model.lines[lineIndex].type,
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
    const charsPerRow = this._getCharsPerRow(lineIndex);
    const rows = [];
    let start = 0;

    while (start < lineText.length) {
      // Tentative end of this row (naïve wrap point)
      let end = Math.min(start + charsPerRow, lineText.length);

      if (end < lineText.length) {
        // --- Step 1: If the boundary falls on spaces, consume them all.
        // This way rows end with "hello " (as typed) and the next row starts at the first non-space.
        while (lineText[end] === " ") {
          end += 1;
        }

        // --- Step 2: If we’re in the middle of a word, backtrack to the last space.
        // This prevents splitting "hellow" into "hello" + "w".
        const lastSpace = lineText.lastIndexOf(" ", end);
        if (lastSpace > start && lastSpace < end) {
          end = lastSpace + 1;
        }
      }

      // Slice the row and push it into the result
      rows.push(lineText.slice(start, end));

      // Move start to the next character
      start = end;
    }

    // Always return at least one row (even for an empty string)
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

  getTopSpacing(lineIndex, isFirstOnPage) {
    if (isFirstOnPage || lineIndex === 0) return 0;

    const lineObj = this.model.lines[lineIndex];
    if (lineObj.type === "scene-heading") {
      return 2 * this.BASE_LINE_HEIGHT;
    }
    if (["character", "action", "transition", "shot"].includes(lineObj.type)) {
      return 1 * this.BASE_LINE_HEIGHT;
    }
    return 0;
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
      (p) =>
        p.top < scrollTop + clientHeight + 300 &&
        p.top + p.height > scrollTop - 300,
    ); //300px buffer

    // 3. Render
    this.container.innerHTML = "";
    this.container.appendChild(this.cursorEl);

    const topSpacerHeight = visiblePages.length > 0 ? visiblePages[0].top : 0;
    const topSpacer = document.createElement("div");
    topSpacer.style.height = `${topSpacerHeight}px`;
    this.container.appendChild(topSpacer);

    for (const p of visiblePages) {
      const pageContainer = document.createElement("div");
      for (const entry of p.page.lines) {
        if (entry.topSpacing > 0) {
          const spacer = document.createElement("div");
          spacer.style.height = `${entry.topSpacing}px`;
          pageContainer.appendChild(spacer);
        }

        const lineEl = this._renderLine(entry.index);
        lineEl.dataset.line = entry.index;
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
          { pos: segEnd, type: "bold", open: false },
        );
      if (segment.italic)
        events.push(
          { pos: segStart, type: "italic", open: true },
          { pos: segEnd, type: "italic", open: false },
        );
      if (segment.underline)
        events.push(
          { pos: segStart, type: "underline", open: true },
          { pos: segEnd, type: "underline", open: false },
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
        { pos: selEnd, type: "selection", open: false },
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
        { pos: match.end, type, open: false },
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
      false,
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

  viewToModelPos({ clientX, clientY }) {
    const lines = Array.from(
      this.container.querySelectorAll(".line[data-line]"),
    );
    if (lines.length === 0) return { line: 0, ch: 0 };

    const containerRect = this.container.getBoundingClientRect();

    // Handle coordinates way outside the viewport
    const maxDistance = 1000; // pixels
    let adjustedClientY = clientY;

    if (clientY < containerRect.top - maxDistance) {
      // Way above - go to document start
      return { line: 0, ch: 0 };
    } else if (clientY > containerRect.bottom + maxDistance) {
      // Way below - go to document end
      const lastLine = this.model.lines.length - 1;
      return { line: lastLine, ch: this.model.getLineLength(lastLine) };
    } else if (clientY < containerRect.top) {
      // Above the container - select first visible line
      adjustedClientY = containerRect.top + 5;
    } else if (clientY > containerRect.bottom) {
      // Below the container - select last visible line
      adjustedClientY = containerRect.bottom - 5;
    }

    let targetLineEl = null;

    // First, try to find a line that directly contains the Y-coordinate
    for (const lineEl of lines) {
      const rect = lineEl.getBoundingClientRect();
      if (adjustedClientY >= rect.top && adjustedClientY <= rect.bottom) {
        targetLineEl = lineEl;
        break;
      }
    }

    // If no line contains the Y (e.g., click in a margin), fall back to closest center
    if (!targetLineEl) {
      let minLineDist = Infinity;
      let closestLineIdx = -1;
      lines.forEach((lineEl, idx) => {
        const rect = lineEl.getBoundingClientRect();
        const lineCenterY = (rect.top + rect.bottom) / 2;
        const dist = Math.abs(adjustedClientY - lineCenterY);
        if (dist < minLineDist) {
          minLineDist = dist;
          closestLineIdx = idx;
        }
      });
      if (closestLineIdx !== -1) {
        targetLineEl = lines[closestLineIdx];
      } else {
        return { line: 0, ch: 0 };
      }
    }

    const lineEl = targetLineEl;
    const lineRect = lineEl.getBoundingClientRect();
    const modelLineIndex = parseInt(lineEl.dataset.line, 10);

    // Handle horizontal bounds
    if (clientX < lineRect.left) {
      // Left of the line - position at start
      return { line: modelLineIndex, ch: 0 };
    } else if (clientX > lineRect.right) {
      // Right of the line - position at end
      return {
        line: modelLineIndex,
        ch: this.model.getLineLength(modelLineIndex),
      };
    }

    const walker = document.createTreeWalker(
      lineEl,
      NodeFilter.SHOW_TEXT,
      null,
    );
    const range = document.createRange();

    let closestCh = 0;
    let totalOffset = 0;
    let minDist = Infinity;

    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      const len = textNode.length;

      for (let i = 0; i <= len; i++) {
        try {
          range.setStart(textNode, i);
          range.setEnd(textNode, i);

          const rects = range.getClientRects();
          if (rects.length === 0) continue;

          // choose the rect for this caret position
          const rect = rects[rects.length - 1];

          const distX = Math.abs(clientX - rect.left);
          const distY = Math.abs(clientY - (rect.top + rect.bottom) / 2);
          const dist = Math.hypot(distX, distY);

          if (dist < minDist) {
            minDist = dist;
            closestCh = totalOffset + i;
          }
          // eslint-disable-next-line no-unused-vars
        } catch (_) {
          // Skip invalid positions
        }
      }

      totalOffset += len;
    }

    return { line: modelLineIndex, ch: closestCh };
  }
}
