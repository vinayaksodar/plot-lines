import { PointerHandler } from "./handlers/PointerHandler.js";
import { KeyboardHandler } from "./handlers/KeyboardHandler.js";
import { SearchHandler } from "./handlers/SearchHandler.js";
import { ToolbarHandler } from "./handlers/ToolbarHandler.js";
import {
  ToggleInlineStyleCommand,
  DeleteSelectionCommand,
  InsertTextCommand,
} from "./commands.js";

export class EditorController {
  constructor() {
    this.editor = null;
    this.model = null;
    this.view = null;

    this.container = null;
    this.hiddenInput = null;
    this.toolbar = null;

    this.pointerHandler = null;
    this.keyBoardHandler = null;
    this.searchHandler = null;
    this.toolbarHandler = null;
  }

  initialize(editor, toolbar, hiddenInput) {
    this.editor = editor;
    this.model = editor.getModel();
    this.view = editor.getView();

    this.container = this.view.container;
    this.toolbar = toolbar;
    this.hiddenInput = hiddenInput;

    // Setup handlers
    this.pointerHandler = new PointerHandler(this.editor);
    this.keyBoardHandler = new KeyboardHandler(this.editor, this.hiddenInput);
    this.searchHandler = new SearchHandler(this.editor);
    this.toolbarHandler = new ToolbarHandler(
      this.editor,
      this.toolbar,
      editor.persistence,
      this.hiddenInput,
    );

    // Add event listeners
    this.container.addEventListener("click", () => this.hiddenInput.focus());
    this.hiddenInput.focus();
    window.addEventListener("keydown", this.onGlobalKeyDown);
  }

  onGlobalKeyDown = (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isCtrlOrCmd && e.key === "f") {
      e.preventDefault();
      this.view.showSearchWidget();
      this.view.searchWidget.querySelector(".search-input").focus();
      return;
    }

    if (isCtrlOrCmd && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      this.editor.undo();
      return;
    }

    if (isCtrlOrCmd && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      this.editor.redo();
      return;
    }

    if (e.key === "Escape") {
      this.searchHandler.closeSearch();
      this.hiddenInput.focus();
    }
  };

  handleClick({ clientPos }) {
    this.model.clearSelection();
    const { line, ch } = this.view.viewToModelPos(clientPos);
    this.model.updateCursor({ line, ch });
    this.view.render();
    this.hiddenInput.focus();
  }

  handleToggleInlineStyle(style) {
    this.editor.executeCommand(new ToggleInlineStyleCommand(style));
  }

  async handleCut() {
    if (this.model.hasSelection()) {
      const text = this.model.getSelectedText();
      try {
        await navigator.clipboard.writeText(text);
        this.editor.executeCommand(new DeleteSelectionCommand());
      } catch (error) {
        console.error("Cut failed:", error);
        this.editor.executeCommand(new DeleteSelectionCommand());
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
      }
    }
  }

  async handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        this.editor.executeCommand(new InsertTextCommand(text));
      }
    } catch (error) {
      console.error("Paste failed:", error);
    }
  }

  handleSearch() {
    this.view.showSearchWidget();
    this.view.searchWidget.querySelector(".search-input").focus();
  }

  focusEditor() {
    this.hiddenInput.focus();
    this.view.render();
  }
}
