import { createSearchWidget } from "../components/SearchWidget/SearchWidget,js";
import { createLineNumbers, LineNumbersWidget } from "../components/LineNumbers/LineNumbers.js";

export class EditorView {
  constructor(model, container, widgetLayer, lineNumbersContainer) {
    this.model = model;
    this.container = container;
    this.widgetLayer = widgetLayer;
    this.lineNumbersContainer = lineNumbersContainer;

    // Create floating search widget inside widget layer
    this.searchWidget = createSearchWidget();
    this.widgetLayer.appendChild(this.searchWidget);
    this.searchMatches = [];

    // Create line numbers widget
    if (this.lineNumbersContainer) {
      this.lineNumbers = new LineNumbersWidget(this.lineNumbersContainer);
    }

    this.cursorEl = document.createElement("div");
    this.cursorEl.className = "cursor";
    container.appendChild(this.cursorEl);

    this.cursorBlinkInterval = null;
    this.cursorBlinkTimeout = null;

    this.startBlink(); // Start blinking when editor first loads

    this.startLine = 0;
    this.endLine = 0;

    this.container.addEventListener("scroll", () => {
      requestAnimationFrame(() => {
        this.render();
        // Sync line numbers scroll
        if (this.lineNumbers) {
          this.lineNumbers.syncScroll(this.container.scrollTop);
        }
      });
    });
  }

  highlightMatches(ranges, currentIndex = -1) {
    this.searchMatches = ranges;
    this.currentMatchIndex = currentIndex;

    // Build line → matches[] index for fast lookup
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
    
    // Get computed line height with fallbacks for different screen sizes
    let lineHeight = parseInt(
      getComputedStyle(this.container).lineHeight,
      10
    );
    
    // Fallback if computed style returns 'normal' or invalid value
    if (!lineHeight || isNaN(lineHeight)) {
      const fontSize = parseInt(getComputedStyle(this.container).fontSize, 10);
      lineHeight = Math.round(fontSize * 1.4); // Approximate line-height ratio
    }
    
    const buffer = 5;

    const totalLines = this.model.lines.length;
    const startLine = Math.max(0, Math.floor(scrollTop / lineHeight) - buffer);
    const visibleLines = Math.ceil(clientHeight / lineHeight) + 2 * buffer;
    const endLine = Math.min(totalLines, startLine + visibleLines);
    this.startLine = startLine;
    this.endLine = endLine;

    // Clear container (but keep cursor alive separately if needed)
    this.container.innerHTML = "";
    this.container.appendChild(this.cursorEl);

    const beforeSpacer = document.createElement("div");
    beforeSpacer.style.height = startLine * lineHeight + "px";
    this.container.appendChild(beforeSpacer);

    const sel = this.model.hasSelection()
      ? this.model.normalizeSelection()
      : null;

    this.cursorEl.style.display = "block";

    for (let idx = startLine; idx < endLine; idx++) {
      const text = this.model.lines[idx];
      const lineEl = document.createElement("div");
      lineEl.className = "line";

      // Collect matches for this line
      const lineMatches = this.matchesByLine?.get(idx) || [];

      // Collect markers (selection + matches)
      const markers = [];

      if (sel && idx >= sel.start.line && idx <= sel.end.line) {
        markers.push({
          start: sel.start.line === idx ? sel.start.ch : 0,
          end: sel.end.line === idx ? sel.end.ch : text.length,
          type: "selection",
        });
      }

      for (const m of lineMatches) {
        markers.push({
          start: m.start,
          end: m.end,
          type:
            this.currentMatchIndex >= 0 &&
            this.searchMatches[this.currentMatchIndex] === m
              ? "search-match-current"
              : "search-match",
        });
      }

      if (!text) {
        // Empty line → either plain or selection
        if (markers.length > 0) {
          const span = document.createElement("span");
          span.className = markers[0].type;
          span.appendChild(document.createTextNode("\u200B"));
          lineEl.appendChild(span);
        } else {
          lineEl.appendChild(document.createTextNode("\u200B"));
        }
      } else if (markers.length === 0) {
        // Plain line
        lineEl.appendChild(document.createTextNode(text));
      } else {
        // Line with highlights (selection / matches)
        const events = [];
        for (const m of markers) {
          events.push({ pos: m.start, type: m.type, open: true });
          events.push({ pos: m.end, type: m.type, open: false });
        }

        // Sort: close before open at same pos
        events.sort((a, b) => a.pos - b.pos || (a.open ? -1 : 1));

        let active = [];
        let lastPos = 0;

        const flush = (from, to) => {
          if (from >= to) return;
          const segText = text.slice(from, to);

          let node = document.createTextNode(segText);
          for (let i = active.length - 1; i >= 0; i--) {
            const span = document.createElement("span");
            span.className = active[i];
            span.appendChild(node);
            node = span;
          }
          lineEl.appendChild(node);
        };

        for (const ev of events) {
          flush(lastPos, ev.pos);
          if (ev.open) active.push(ev.type);
          else active = active.filter((t) => t !== ev.type);
          lastPos = ev.pos;
        }
        flush(lastPos, text.length);
      }

      this.container.appendChild(lineEl);
    }

    const afterSpacer = document.createElement("div");
    afterSpacer.style.height = (totalLines - endLine) * lineHeight + "px";
    this.container.appendChild(afterSpacer);

    // Update line numbers
    if (this.lineNumbers) {
      this.lineNumbers.render(startLine, endLine, totalLines, lineHeight);
    }

    this.updateCursor();
  }

  updateCursor() {
    const { line, ch } = this.model.cursor;

    // If cursor is outside the rendered slice, hide it
    if (line < this.startLine || line >= this.endLine) {
      this.cursorEl.style.display = "none";
      return;
    }

    // Adjust for DOM structure:
    // 0: cursorEl
    // 1: beforeSpacer
    // 2..: visible lines
    const domIndex = 2 + (line - this.startLine);
    const lineEl = this.container.children[domIndex];
    if (!lineEl) return;

    // Walk text nodes to find character offset
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
      if (walker.currentNode) {
        targetNode = walker.currentNode;
        offset = targetNode.textContent.length;
      } else {
        // Line is empty → add zero-width space
        const emptyNode = document.createTextNode("\u200B");
        lineEl.appendChild(emptyNode);
        targetNode = emptyNode;
        offset = 0;
      }
    }

    const range = document.createRange();
    range.setStart(targetNode, offset);
    range.setEnd(targetNode, offset);

    const rect = range.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    this.cursorEl.style.top = `${
      rect.top - containerRect.top + this.container.scrollTop
    }px`;
    this.cursorEl.style.left = `${
      rect.left - containerRect.left + this.container.scrollLeft
    }px`;
    this.cursorEl.style.height = `${rect.height}px`;

    this.pauseBlinkAndRestart();
  }

  startBlink() {
    if (this.cursorBlinkInterval) clearInterval(this.cursorBlinkInterval);

    this.cursorEl.style.visibility = "visible";

    this.cursorBlinkInterval = setInterval(() => {
      const isVisible = this.cursorEl.style.visibility !== "hidden";
      this.cursorEl.style.visibility = isVisible ? "hidden" : "visible";
    }, 530); // Standard cursor blink rate (about 1.06 seconds per cycle)
  }

  pauseBlinkAndRestart() {
    if (this.cursorBlinkInterval) {
      clearInterval(this.cursorBlinkInterval);
      this.cursorBlinkInterval = null;
    }

    this.cursorEl.style.visibility = "visible";

    if (this.cursorBlinkTimeout) clearTimeout(this.cursorBlinkTimeout);
    this.cursorBlinkTimeout = setTimeout(() => {
      this.startBlink();
    }, 530); // start blinking again after delay
  }

  // Add a method for showing search widget
  showSearchWidget() {
    this.searchWidget.classList.remove("hidden");
    const input = this.searchWidget.querySelector(".search-input");
    input.focus();
    input.select();
  }

  hideSearchWidget() {
    this.searchWidget.classList.add("hidden");
  }

  // Scroll to ensure a specific line is visible
  scrollToLine(lineNumber) {
    const lineHeight = parseInt(
      getComputedStyle(this.container).lineHeight,
      10
    );
    const clientHeight = this.container.clientHeight;
    const visibleLines = Math.ceil(clientHeight / lineHeight);
    
    // Calculate target scroll position to center the line
    const targetScrollTop = Math.max(0, 
      (lineNumber - Math.floor(visibleLines / 2)) * lineHeight
    );
    
    // Only scroll if the line is not currently visible
    const currentScrollTop = this.container.scrollTop;
    const lineTop = lineNumber * lineHeight;
    const lineBottom = lineTop + lineHeight;
    const viewportTop = currentScrollTop;
    const viewportBottom = currentScrollTop + clientHeight;
    
    if (lineTop < viewportTop || lineBottom > viewportBottom) {
      this.container.scrollTop = targetScrollTop;
    }
  }
}
