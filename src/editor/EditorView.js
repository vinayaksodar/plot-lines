import { createSearchWidget } from "../components/SearchWidget/SearchWidget,js";
import { createLineNumbers, LineNumbersWidget } from "../components/LineNumbers/LineNumbers.js";

export class EditorView {
  constructor(model, container, widgetLayer, lineNumbersContainer) {
    this.model = model;
    this.container = container;
    this.widgetLayer = widgetLayer;
    this.lineNumbersContainer = lineNumbersContainer;

    this.searchWidget = createSearchWidget();
    this.widgetLayer.appendChild(this.searchWidget);
    this.searchMatches = [];

    if (this.lineNumbersContainer) {
      this.lineNumbers = new LineNumbersWidget(this.lineNumbersContainer);
    }

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
        if (this.lineNumbers) {
          this.lineNumbers.syncScroll(this.container.scrollTop);
        }
      });
    });
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
    let lineHeight = parseInt(getComputedStyle(this.container).lineHeight, 10) || 20;
    const buffer = 5;

    const totalLines = this.model.lines.length;
    const startLine = Math.max(0, Math.floor(scrollTop / lineHeight) - buffer);
    const endLine = Math.min(totalLines, startLine + Math.ceil(clientHeight / lineHeight) + 2 * buffer);
    
    this.startLine = startLine;
    this.endLine = endLine;

    this.container.innerHTML = ""; // Clear container
    this.container.appendChild(this.cursorEl);

    const beforeSpacer = document.createElement("div");
    beforeSpacer.style.height = startLine * lineHeight + "px";
    this.container.appendChild(beforeSpacer);

    for (let i = startLine; i < endLine; i++) {
      const lineEl = this._renderLine(i);
      this.container.appendChild(lineEl);
    }

    const afterSpacer = document.createElement("div");
    afterSpacer.style.height = (totalLines - endLine) * lineHeight + "px";
    this.container.appendChild(afterSpacer);

    if (this.lineNumbers) {
      this.lineNumbers.render(startLine, endLine, totalLines, lineHeight);
    }

    this.updateCursor();
  }

  _renderLine(lineIndex) {
    const lineObj = this.model.lines[lineIndex];
    const lineEl = document.createElement("div");
    lineEl.className = `line ${lineObj.type}`;

    const lineText = lineObj.segments.map(s => s.text).join('');
    if (lineText === '') {
        lineEl.appendChild(document.createTextNode("\u200B"));
        return lineEl;
    }

    const selection = this.model.hasSelection() ? this.model.normalizeSelection() : null;
    const lineMatches = this.matchesByLine?.get(lineIndex) || [];
    
    const events = [];
    
    let chCount = 0;
    for(const segment of lineObj.segments) {
        const segStart = chCount;
        const segEnd = segStart + segment.text.length;
        chCount = segEnd;

        if (segment.bold) {
            events.push({ pos: segStart, type: 'bold', open: true });
            events.push({ pos: segEnd, type: 'bold', open: false });
        }
        if (segment.italic) {
            events.push({ pos: segStart, type: 'italic', open: true });
            events.push({ pos: segEnd, type: 'italic', open: false });
        }
        if (segment.underline) {
            events.push({ pos: segStart, type: 'underline', open: true });
            events.push({ pos: segEnd, type: 'underline', open: false });
        }
    }

    if (selection && lineIndex >= selection.start.line && lineIndex <= selection.end.line) {
        const selStart = (lineIndex === selection.start.line) ? selection.start.ch : 0;
        const selEnd = (lineIndex === selection.end.line) ? selection.end.ch : lineText.length;
        events.push({ pos: selStart, type: 'selection', open: true });
        events.push({ pos: selEnd, type: 'selection', open: false });
    }

    for (const match of lineMatches) {
        const type = this.currentMatchIndex >= 0 && this.searchMatches[this.currentMatchIndex] === match ? 'search-match-current' : 'search-match';
        events.push({ pos: match.start, type, open: true });
        events.push({ pos: match.end, type, open: false });
    }

    events.sort((a, b) => a.pos - b.pos || (a.open ? 1 : -1));

    let activeClasses = [];
    let lastPos = 0;

    const flush = (from, to) => {
        if (from >= to) return;
        const text = lineText.slice(from, to);
        const span = document.createElement('span');
        if (activeClasses.length) {
            span.className = activeClasses.join(' ');
        }
        span.textContent = text;
        lineEl.appendChild(span);
    };

    for (const event of events) {
        flush(lastPos, event.pos);
        if (event.open) {
            activeClasses.push(event.type);
        } else {
            activeClasses = activeClasses.filter(c => c !== event.type);
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

    const domIndex = 2 + (line - this.startLine);
    const lineEl = this.container.children[domIndex];
    if (!lineEl) return;

    const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT, null, false);
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
        if(lineEl.lastChild && lineEl.lastChild.nodeType === Node.TEXT_NODE) {
            targetNode = lineEl.lastChild;
            offset = lineEl.lastChild.textContent.length;
        } else { // Empty line
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

    this.cursorEl.style.top = `${rect.top - containerRect.top + this.container.scrollTop}px`;
    this.cursorEl.style.left = `${rect.left - containerRect.left + this.container.scrollLeft}px`;
    this.cursorEl.style.height = `${rect.height}px`;

    this.pauseBlinkAndRestart();
  }

  startBlink() {
    if (this.cursorBlinkInterval) clearInterval(this.cursorBlinkInterval);
    this.cursorEl.style.visibility = "visible";
    this.cursorBlinkInterval = setInterval(() => {
      this.cursorEl.style.visibility = this.cursorEl.style.visibility === "hidden" ? "visible" : "hidden";
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
    const lineHeight = parseInt(getComputedStyle(this.container).lineHeight, 10) || 20;
    const clientHeight = this.container.clientHeight;
    const visibleLines = Math.ceil(clientHeight / lineHeight);
    const targetScrollTop = Math.max(0, (lineNumber - Math.floor(visibleLines / 2)) * lineHeight);
    
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