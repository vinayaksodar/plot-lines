import { NaiveLayoutManager } from "./NaiveLayoutManager.js";
import { createSearchWidget } from "../components/SearchWidget/SearchWidget.js";

export class EditorView {
  constructor(model, container, widgetLayer) {
    this.model = model;
    this.container = container;
    this.widgetLayer = widgetLayer;

    this.linesContainer = document.createElement("div");
    this.container.appendChild(this.linesContainer);

    this.ELEMENT_CHARS_PER_ROW = {
      "scene-heading": 60,
      action: 60,
      character: 25,
      parenthetical: 20,
      dialogue: 40,
      transition: 15,
      shot: 60,
    };
    const computedStyle = getComputedStyle(this.container);
    const BASE_LINE_HEIGHT = parseInt(computedStyle.lineHeight, 10) || 16;
    this.BASE_LINE_HEIGHT = BASE_LINE_HEIGHT;
    this.PADDING_LEFT = parseInt(computedStyle.paddingLeft, 10) || 0;
    this.PADDING_TOP = parseInt(computedStyle.paddingTop, 10) || 0;

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

    this.searchMatches = [];
    this.currentMatchIndex = -1;
    this.matchesByLine = new Map();

    this.searchMatchesLayer = document.createElement("div");
    this.searchMatchesLayer.className = "search-matches-layer";
    this.widgetLayer.appendChild(this.searchMatchesLayer);

    this.remoteCursorData = new Map();
    this.remoteCursorElements = new Map();

    this.cursorEl = document.createElement("div");
    this.cursorEl.className = "cursor";
    this.cursorEl.style.position = "absolute";
    this.cursorEl.style.zIndex = "1";
    this.widgetLayer.appendChild(this.cursorEl);

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
        // This preserves your original whitespace behavior exactly.
        while (lineText[end] === " ") {
          end += 1;
        }

        // --- New Step 1b: If the boundary falls on a hyphen, consume exactly one hyphen.
        // This allows breaking *after* a hyphen but does NOT collapse multiple hyphens.
        if (lineText[end] === "-") {
          end += 1; // consume a single hyphen only
        } else {
          // --- Step 2: If we’re in the middle of a word, backtrack to the last break.
          // Treat both spaces and hyphens as valid break points for backtracking.
          const lastSpace = lineText.lastIndexOf(" ", end);
          const lastHyphen = lineText.lastIndexOf("-", end);
          const lastBreak = Math.max(lastSpace, lastHyphen);

          if (lastBreak > start && lastBreak < end) {
            end = lastBreak + 1;
          }
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
  render(renderContext = {}) {
    const scrollTop = this.container.scrollTop;
    const clientHeight = this.container.clientHeight;

    const pageLineRanges = this.layoutManager.getPageLineRanges();
    if (pageLineRanges.length === 0) {
      this.container.innerHTML = "";
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
    this.linesContainer.innerHTML = "";

    const topSpacerHeight = visiblePages.length > 0 ? visiblePages[0].top : 0;
    const topSpacer = document.createElement("div");
    topSpacer.style.height = `${topSpacerHeight}px`;
    this.linesContainer.appendChild(topSpacer);

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
      this.linesContainer.appendChild(pageContainer);
    }

    const lastVisiblePage = visiblePages[visiblePages.length - 1];
    const bottomSpacerHeight = lastVisiblePage
      ? totalHeight - (lastVisiblePage.top + lastVisiblePage.height)
      : totalHeight;
    const bottomSpacer = document.createElement("div");
    bottomSpacer.style.height = `${Math.max(0, bottomSpacerHeight)}px`;
    this.linesContainer.appendChild(bottomSpacer);

    this.updateCursor();
    this._renderSelection();
    this._renderSearchMatches();
    this._renderRemoteCursors(renderContext.remoteCursors);
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

  _renderSelection() {
    if (!this.selectionLayer) {
      this.selectionLayer = document.createElement("div");
      this.selectionLayer.className = "selection-layer";
      this.widgetLayer.appendChild(this.selectionLayer);
    }
    this.selectionLayer.innerHTML = "";

    if (!this.model.hasSelection()) {
      return;
    }

    const selection = this.model.normalizeSelection(this.model.selection);
    const containerRect = this.container.getBoundingClientRect();

    for (
      let lineIndex = selection.start.line;
      lineIndex <= selection.end.line;
      lineIndex++
    ) {
      const lineEl = this.linesContainer.querySelector(
        `[data-line="${lineIndex}"]`,
      );
      if (!lineEl) continue;

      const lineText = this._getLineText(lineIndex);
      const selStart =
        lineIndex === selection.start.line ? selection.start.ch : 0;
      const selEnd =
        lineIndex === selection.end.line ? selection.end.ch : lineText.length;

      if (selStart === selEnd) continue;

      const range = document.createRange();
      const walker = document.createTreeWalker(
        lineEl,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );
      let chCount = 0;
      let startNode, startOffset, endNode, endOffset;

      while (walker.nextNode()) {
        const node = walker.currentNode;
        const nodeLen = node.textContent.length;
        if (startNode === undefined && chCount + nodeLen >= selStart) {
          startNode = node;
          startOffset = selStart - chCount;
        }
        if (endNode === undefined && chCount + nodeLen >= selEnd) {
          endNode = node;
          endOffset = selEnd - chCount;
        }
        if (startNode !== undefined && endNode !== undefined) break;
        chCount += nodeLen;
      }

      if (!startNode) {
        // selection starts after all text
        const lastText = Array.from(lineEl.childNodes)
          .filter((n) => n.nodeType === 3)
          .pop();
        if (!lastText) continue;
        startNode = endNode = lastText;
        startOffset = endOffset = lastText.length;
      }
      if (!endNode) {
        // selection ends after all text
        const lastText = Array.from(lineEl.childNodes)
          .filter((n) => n.nodeType === 3)
          .pop();
        if (!lastText) continue;
        endNode = lastText;
        endOffset = lastText.length;
      }

      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);

      const rects = range.getClientRects();
      for (const rect of rects) {
        const selectionEl = document.createElement("div");
        selectionEl.className = "selection";
        selectionEl.style.position = "absolute";
        selectionEl.style.top = `${rect.top - containerRect.top + this.container.scrollTop - this.PADDING_TOP}px`;
        selectionEl.style.left = `${rect.left - containerRect.left - this.PADDING_LEFT}px`;
        selectionEl.style.width = `${rect.width}px`;
        selectionEl.style.height = `${rect.height}px`;
        this.selectionLayer.appendChild(selectionEl);
      }
    }
  }

  updateCursor() {
    const { line, ch } = this.model.getCursorPos();
    const lineEl = this.linesContainer.querySelector(`[data-line="${line}"]`);

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
        rect.top -
        containerRect.top +
        this.container.scrollTop -
        this.PADDING_TOP
      }px`;
      this.cursorEl.style.left = `${
        rect.left - containerRect.left - this.PADDING_LEFT
      }px`;
      this.cursorEl.style.height = `${rect.height}px`;
    }

    this.pauseBlinkAndRestart();
  }

  updateRemoteCursors(remoteCursors) {
    this.remoteCursorData = remoteCursors;
    this.render();
  }

  _renderRemoteCursors() {
    console.log(
      "[EditorView] Rendering remote cursors:",
      this.remoteCursorData,
    );
    const oldCursors = new Set(this.remoteCursorElements.keys());

    for (const [userID, cursorData] of this.remoteCursorData.entries()) {
      oldCursors.delete(userID);
      let cursorEl = this.remoteCursorElements.get(userID);
      if (!cursorEl) {
        cursorEl = document.createElement("div");
        cursorEl.className = "remote-cursor";
        cursorEl.style.position = "absolute";

        const nameLabel = document.createElement("div");
        nameLabel.className = "remote-cursor-label";
        nameLabel.textContent = cursorData.userName;
        nameLabel.style.display = "none"; // Initially hidden
        cursorEl.appendChild(nameLabel);

        cursorEl.addEventListener("mouseenter", () => {
          nameLabel.style.display = "block";
        });
        cursorEl.addEventListener("mouseleave", () => {
          nameLabel.style.display = "none";
        });

        this.widgetLayer.appendChild(cursorEl);
        this.remoteCursorElements.set(userID, cursorEl);
      } else {
        // Update existing nameLabel if userName changes
        const nameLabel = cursorEl.querySelector(".remote-cursor-label");
        if (nameLabel) {
          nameLabel.textContent = cursorData.userName;
        }
      }

      const { line, ch } = cursorData.cursor;
      const lineEl = this.container.querySelector(`[data-line="${line}"]`);

      if (!lineEl) {
        cursorEl.style.display = "none";
        continue;
      }
      cursorEl.style.display = "block";

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
        cursorEl.style.top = `${
          rect.top -
          containerRect.top +
          this.container.scrollTop -
          this.PADDING_TOP
        }px`;
        cursorEl.style.left = `${
          rect.left - containerRect.left - this.PADDING_LEFT
        }px`;
        cursorEl.style.height = `${rect.height}px`;
      }
    }

    for (const userID of oldCursors) {
      const cursorEl = this.remoteCursorElements.get(userID);
      if (cursorEl) {
        cursorEl.remove();
        this.remoteCursorElements.delete(userID);
      }
    }
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
    this.startBlink();
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

  _renderSearchMatches() {
    this.searchMatchesLayer.innerHTML = "";

    if (this.searchMatches.length === 0) {
      return;
    }

    const containerRect = this.container.getBoundingClientRect();

    for (let i = 0; i < this.searchMatches.length; i++) {
      const match = this.searchMatches[i];
      const lineEl = this.linesContainer.querySelector(
        `[data-line="${match.line}"]`,
      );
      if (!lineEl) continue;

      const range = document.createRange();
      const walker = document.createTreeWalker(
        lineEl,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );
      let chCount = 0;
      let startNode, startOffset, endNode, endOffset;

      while (walker.nextNode()) {
        const node = walker.currentNode;
        const nodeLen = node.textContent.length;
        if (startNode === undefined && chCount + nodeLen >= match.start) {
          startNode = node;
          startOffset = match.start - chCount;
        }
        if (endNode === undefined && chCount + nodeLen >= match.end) {
          endNode = node;
          endOffset = match.end - chCount;
        }
        if (startNode !== undefined && endNode !== undefined) break;
        chCount += nodeLen;
      }

      if (!startNode) continue;
      if (!endNode) {
        const lastText = Array.from(lineEl.childNodes)
          .filter((n) => n.nodeType === 3)
          .pop();
        if (!lastText) continue;
        endNode = lastText;
        endOffset = lastText.length;
      }

      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);

      const rects = range.getClientRects();
      for (const rect of rects) {
        const matchEl = document.createElement("div");
        matchEl.className = "search-match";
        if (i === this.currentMatchIndex) {
          matchEl.classList.add("search-match-current");
        }
        matchEl.style.position = "absolute";
        matchEl.style.top = `${rect.top - containerRect.top + this.container.scrollTop - this.PADDING_TOP}px`;
        matchEl.style.left = `${rect.left - containerRect.left - this.PADDING_LEFT}px`;
        matchEl.style.width = `${rect.width}px`;
        matchEl.style.height = `${rect.height}px`;
        this.searchMatchesLayer.appendChild(matchEl);
      }
    }
  }
}
