export class ToolbarHandler {
  constructor(controller, toolbar, hiddenInput) {
    this.controller = controller;
    this.toolbar = toolbar;
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
    try {
      switch (action) {
        case "undo":
          this.controller.undo();
          this.hiddenInput.focus();
          break;
        case "redo":
          this.controller.redo();
          this.hiddenInput.focus();
          break;
        case "cut":
          await this.controller.handleCut();
          this.hiddenInput.focus();
          break;
        case "copy":
          await this.controller.handleCopy();
          this.hiddenInput.focus();
          break;
        case "paste":
          await this.controller.handlePaste();
          this.hiddenInput.focus();
          break;
        case "search":
          this.controller.handleSearch();
          break;
        case "set-line-type":
          this.controller.handleSetLineType(value);
          this.hiddenInput.focus();
          break;
        case "toggle-inline-style":
          this.controller.handleToggleInlineStyle(value);
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
