import { SetLineTypeCommand } from "../commands.js";

export class ToolbarHandler {
  constructor(editor, toolbar, persistence, hiddenInput) {
    this.editor = editor;
    this.toolbar = toolbar;
    this.persistence = persistence;
    this.hiddenInput = hiddenInput;

    if (this.toolbar) {
      this.toolbar.addEventListener("click", this.handleToolbarClick);
    }
  }

  handleToolbarClick = (e) => {
    const button = e.target.closest(".iconbtn");
    if (!button) return;

    const action = button.dataset.action;
    const value = button.dataset.type || button.dataset.style;
    this.handleToolbarAction(action, value);
  };

  async handleToolbarAction(action, value) {
    const { editor } = this;
    try {
      switch (action) {
        case "new":
          this.persistence.new();
          break;
        case "open":
          await this.persistence.import();
          break;
        case "save":
          this.persistence.save();
          break;
        case "export":
          this.persistence.export();
          break;
        case "import-fountain":
          await this.persistence.import("fountain");
          break;
        case "export-fountain":
          this.persistence.export("fountain");
          break;
        case "files":
          this.persistence.manage();
          break;
        case "undo":
          editor.undo();
          this.hiddenInput.focus();
          break;
        case "redo":
          editor.redo();
          this.hiddenInput.focus();
          break;
        case "cut":
          await editor.controller.handleCut();
          this.hiddenInput.focus();
          break;
        case "copy":
          await editor.controller.handleCopy();
          this.hiddenInput.focus();
          break;
        case "paste":
          await editor.controller.handlePaste();
          this.hiddenInput.focus();
          break;
        case "search":
          editor.controller.handleSearch();
          break;
        case "set-line-type":
          editor.executeCommand(new SetLineTypeCommand(value));
          this.hiddenInput.focus();
          break;
        case "toggle-inline-style":
          editor.controller.handleToggleInlineStyle(value);
          this.hiddenInput.focus();
          break;
      }
    } catch (error) {
      console.error("Toolbar action failed:", error);
      alert("Operation failed: " + error.message);
      this.hiddenInput.focus();
    }
  }

  destroy() {
    if (this.toolbar) {
      this.toolbar.removeEventListener("click", this.handleToolbarClick);
    }
  }
}
