import { UndoManager } from "./undoManager.js";
import {
  DeleteCharCommand,
  InsertCharCommand,
  InsertNewLineCommand,
  DeleteSelectionCommand,
  InsertTextCommand,
} from "./commands.js";
import { PointerHandler } from "./handlers/PointerHandler.js";
import { KeyboardHandler } from "./handlers/KeyboardHandler.js";
import { SearchHandler } from "./handlers/SearchHandler.js";
import { FileManager } from "./handlers/FileHandler.js";
import { ToolbarHandler } from "./handlers/ToolbarHandler.js";

export class EditorController {
  constructor(model, view, wrapper, toolbar, hiddenInput) {
    this.model = model;
    this.view = view;
    this.container = view.container;
    this.hiddenInput = hiddenInput;
    this.toolbar = toolbar;

    // Ensure container gets focus when clicked
    this.container.addEventListener("click", () => {
      this.hiddenInput.focus();
    });

    this.hiddenInput.focus();

    this.pointerHandler = new PointerHandler(this, this.container);
    this.keyBoardHandler = new KeyboardHandler(this, this.hiddenInput);
    this.searchHandler = new SearchHandler(this, this.view, this.model);
    this.fileManager = new FileManager(this.model, this.view, this.hiddenInput);
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
    const lines = Array.from(this.container.querySelectorAll(".line"));
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
      const lastLineText = this.model.lines[lastLine] || "";
      return { line: lastLine, ch: lastLineText.length };
    } else if (clientY < containerRect.top) {
      // Above the container - select first visible line
      adjustedClientY = containerRect.top + 5;
    } else if (clientY > containerRect.bottom) {
      // Below the container - select last visible line
      adjustedClientY = containerRect.bottom - 5;
    }

    let closestLineIdx = 0;
    let minLineDist = Infinity;

    // Find the line vertically closest to the click
    lines.forEach((lineEl, idx) => {
      const rect = lineEl.getBoundingClientRect();
      const lineCenterY = (rect.top + rect.bottom) / 2;
      const dist = Math.abs(adjustedClientY - lineCenterY);
      if (dist < minLineDist) {
        minLineDist = dist;
        closestLineIdx = idx;
      }
    });

    const lineEl = lines[closestLineIdx];
    const lineRect = lineEl.getBoundingClientRect();

    // Handle horizontal bounds
    let adjustedClientX = clientX;
    if (clientX < lineRect.left) {
      // Left of the line - position at start
      return { line: this.view.startLine + closestLineIdx, ch: 0 };
    } else if (clientX > lineRect.right) {
      // Right of the line - position at end
      const lineText =
        this.model.lines[this.view.startLine + closestLineIdx] || "";
      return {
        line: this.view.startLine + closestLineIdx,
        ch: lineText.length,
      };
    }

    const walker = document.createTreeWalker(
      lineEl,
      NodeFilter.SHOW_TEXT,
      null
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
          range.setStart(textNode, 0);
          range.setEnd(textNode, i);
          const rect = range.getBoundingClientRect();
          const x = rect.left + (rect.width || 0);

          const dist = Math.abs(adjustedClientX - x);
          if (dist < minDist) {
            minDist = dist;
            closestCh = totalOffset + i;
          }
        } catch (_) {
          // Skip invalid positions
        }
      }

      totalOffset += len;
    }

    return { line: this.view.startLine + closestLineIdx, ch: closestCh };
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
