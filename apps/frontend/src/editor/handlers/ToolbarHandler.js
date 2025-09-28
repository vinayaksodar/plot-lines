import { SetLineTypeCommand } from "../commands.js";

export class ToolbarHandler {
  constructor(editor, toolbar, fileManager, hiddenInput) {
    this.editor = editor;
    this.toolbar = toolbar;
    this.fileManager = fileManager;
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
          this.fileManager.handleNewFile();
          break;
        case "open":
          await this.fileManager.handleOpenFile();
          break;
        case "save":
          this.fileManager.handleSaveFile();
          break;
        case "export":
          this.fileManager.handleExportFile();
          break;
        case "import-fountain":
          await this.fileManager.handleImportFountain();
          break;
        case "export-fountain":
          this.fileManager.handleExportFountain();
          break;
        case "files":
          this.fileManager.handleManageFiles();
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