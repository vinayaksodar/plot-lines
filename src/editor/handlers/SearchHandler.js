export class SearchHandler {
  constructor(controller, view, model) {
    this.controller = controller;
    this.view = view;
    this.model = model;

    this.widget = this.view.searchWidget;
    this.input = this.widget.querySelector(".search-input");

    this.currentMatches = [];
    this.currentMatchIndex = -1;

    this._bindEvents();
  }

  _bindEvents() {
    // Input changes → search
    this.input.addEventListener("input", () => {
      this.performSearch(this.input.value);
    });

    // Delegate button clicks
    this.widget.addEventListener("click", (e) => {
      const action = e.target.dataset.action;
      if (!action) return;

      if (action === "next") this.jumpToMatch(1);
      if (action === "prev") this.jumpToMatch(-1);
      if (action === "close") this.closeSearch();
    });
  }

  performSearch(term) {
    if (!term) {
      this.currentMatches = [];
      this.view.clearHighlights();
      return;
    }

    // find matches across all lines
    this.currentMatches = [];
    this.model.lines.forEach((line, lineIdx) => {
      let start = 0;
      while (true) {
        const idx = line.indexOf(term, start);
        if (idx === -1) break;
        this.currentMatches.push({
          line: lineIdx,
          start: idx,
          end: idx + term.length,
        });
        start = idx + term.length;
      }
    });

    this.currentMatchIndex = this.currentMatches.length > 0 ? 0 : -1;
    this.view.highlightMatches(this.currentMatches, this.currentMatchIndex);

    if (this.currentMatchIndex >= 0) {
      const match = this.currentMatches[this.currentMatchIndex];
      this.model.updateCursor({ line: match.line, ch: match.start });
      
      // Scroll to ensure the first match is visible
      this.view.scrollToLine(match.line);
      this.view.render();
    }
  }

  jumpToMatch(direction) {
    if (this.currentMatches.length === 0) return;

    this.currentMatchIndex =
      (this.currentMatchIndex + direction + this.currentMatches.length) %
      this.currentMatches.length;

    this.view.highlightMatches(this.currentMatches, this.currentMatchIndex);

    const match = this.currentMatches[this.currentMatchIndex];
    this.model.updateCursor({ line: match.line, ch: match.start });
    
    // Scroll to ensure the match is visible
    this.view.scrollToLine(match.line);
    this.view.render();
  }

  closeSearch() {
    // Clear all search state
    this.currentMatches = [];
    this.currentMatchIndex = -1;
    
    // Clear highlights
    this.view.clearHighlights();
    
    // Clear search input
    this.input.value = "";
    
    // Hide the widget
    this.view.hideSearchWidget();
  }
}
