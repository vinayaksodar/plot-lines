import { SetLineTypeCommand, ToggleInlineStyleCommand } from "../commands.js";

export class ToolbarHandler {
  constructor(controller) {
    this.controller = controller;
    this.toolbar = controller.toolbar;
    this.fileManager = controller.fileManager;
    this.hiddenInput = controller.hiddenInput;

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
    const { controller } = this;
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
          controller.handleUndo();
          this.hiddenInput.focus();
          break;
        case "redo":
          controller.handleRedo();
          this.hiddenInput.focus();
          break;
        case "cut":
          await controller.handleCut();
          this.hiddenInput.focus();
          break;
        case "copy":
          await controller.handleCopy();
          this.hiddenInput.focus();
          break;
        case "paste":
          await controller.handlePaste();
          this.hiddenInput.focus();
          break;
        case "search":
          controller.handleSearch();
          break;
        case "set-line-type":
          controller.executeCommand(new SetLineTypeCommand(controller.model, value));
          this.hiddenInput.focus();
          break;
        case "toggle-inline-style":
          controller.handleToggleInlineStyle(value);
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
