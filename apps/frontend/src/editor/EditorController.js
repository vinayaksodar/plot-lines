import { UndoManager } from "./undoManager.js";
import {
  DeleteSelectionCommand,
  InsertTextCommand,
  ToggleInlineStyleCommand,
} from "./commands.js";
import { PointerHandler } from "./handlers/PointerHandler.js";
import { KeyboardHandler } from "./handlers/KeyboardHandler.js";
import { SearchHandler } from "./handlers/SearchHandler.js";
import { ToolbarHandler } from "./handlers/ToolbarHandler.js";

export class EditorController {
  constructor(model, view, wrapper, toolbar, hiddenInput, fileManager) {
    this.model = model;
    this.view = view;
    this.container = view.container;
    this.hiddenInput = hiddenInput;
    this.toolbar = toolbar;
    this.fileManager = fileManager;

    // Ensure container gets focus when clicked
    this.container.addEventListener("click", () => {
      this.hiddenInput.focus();
    });

    this.hiddenInput.focus();

    this.pointerHandler = new PointerHandler(this, this.container);
    this.keyBoardHandler = new KeyboardHandler(this, this.hiddenInput);
    this.searchHandler = new SearchHandler(this, this.view, this.model);
    this.toolbarHandler = new ToolbarHandler(this);
    this.undoManager = new UndoManager();

    // Listen for global shortcuts
    window.addEventListener("keydown", this.onGlobalKeyDown);
  }

  onGlobalKeyDown = (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // Search
    if (isCtrlOrCmd && e.key === "f") {
      e.preventDefault();
      this.view.showSearchWidget();
      this.view.searchWidget.querySelector(".search-input").focus();
      return;
    }

    // Undo/Redo
    if (isCtrlOrCmd && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      this.handleUndo();
      return;
    }

    if (isCtrlOrCmd && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      this.handleRedo();
      return;
    }

    // Escape → Close Search and focus editor
    if (e.key === "Escape") {
      this.searchHandler.closeSearch();
      this.hiddenInput.focus();
    }
  };

  handleClick({ clientPos }) {
    this.model.clearSelection();
    const { line, ch } = this.viewToModelPos(clientPos);
    this.model.updateCursor({ line, ch });
    this.view.render();
    // Ensure the editor container has focus after click
    this.hiddenInput.focus();
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

  handleToggleInlineStyle(style) {
    this.executeCommand(new ToggleInlineStyleCommand(this.model, style));
  }

  handleUndo() {
    if (this.undoManager.canUndo()) {
      this.undoManager.undo();
      this.view.render();
    }
  }

  handleRedo() {
    if (this.undoManager.canRedo()) {
      this.undoManager.redo();
      this.view.render();
    }
  }

  async handleCut() {
    if (this.model.hasSelection()) {
      const text = this.model.getSelectedText();
      try {
        await navigator.clipboard.writeText(text);
        this.executeCommand(new DeleteSelectionCommand(this.model));
      } catch (error) {
        console.error("Cut failed:", error);
        // Fallback: just delete the selection without copying
        this.executeCommand(new DeleteSelectionCommand(this.model));
      }
    }
  }

  async handleCopy() {
    if (this.model.hasSelection()) {
      const text = this.model.getSelectedText();
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        console.error("Copy failed:", error);
        // Could show a message to user that copy failed
      }
    }
  }

  async handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        this.executeCommand(new InsertTextCommand(this.model, text));
      }
    } catch (error) {
      console.error("Paste failed:", error);
      // Could show a message to user that paste failed
    }
  }

  handleSearch() {
    this.view.showSearchWidget();
    this.view.searchWidget.querySelector(".search-input").focus();
  }

  // Execute a command and add it to undo history
  executeCommand(command) {
    command.execute(this.model);
    this.undoManager.add(command);
    this.view.render();
  }

  // Ensure editor is focused and ready for input
  focusEditor() {
    this.hiddenInput.focus();
    // Force a re-render to ensure cursor is visible
    this.view.render();
  }
}
