import {
  transformCursorPosition,
  calculateFinalCursorPosition,
} from "./cursor.js";
import {
  DeleteTextCommand,
  InsertTextCommand,
  SetLineTypeCommand,
  ToggleInlineStyleCommand,
} from "./commands.js";
import { KeyboardHandler } from "./handlers/KeyboardHandler.js";
import { PointerHandler } from "./handlers/PointerHandler.js";
import { SearchHandler } from "./handlers/SearchHandler.js";
import { ToolbarHandler } from "./handlers/ToolbarHandler.js";

export class EditorController {
  constructor({ model, view, undoManager }) {
    this.model = model;
    this.view = view;
    this.undoManager = undoManager;

    this.hiddenInput = null;
    this.toolbar = null;

    this.pointerHandler = null;
    this.keyBoardHandler = null;
    this.searchHandler = null;
    this.toolbarHandler = null;

    this.plugins = [];
  }

  initialize(toolbar, hiddenInput, searchWidget) {
    this.toolbar = toolbar;
    this.hiddenInput = hiddenInput;
    this.searchWidget = searchWidget;

    this._initializeHandlers();
    this._initializeEventListeners();
  }

  _initializeHandlers() {
    // Setup handlers
    this.pointerHandler = new PointerHandler(this);
    this.keyBoardHandler = new KeyboardHandler(this, this.hiddenInput);
    this.searchHandler = new SearchHandler(this, this.searchWidget);
    this.toolbarHandler = new ToolbarHandler(
      this,
      this.toolbar,
      this.hiddenInput,
    );
  }

  _initializeEventListeners() {
    this.searchHandler.on("close", () => this.hideSearchWidget());

    this.view.container.addEventListener("click", (e) => {
      if (this.searchWidget.contains(e.target)) {
        return;
      }
      this.hiddenInput.focus();
    });
    window.addEventListener("keydown", this.onGlobalKeyDown);
  }

  onGlobalKeyDown = (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isCtrlOrCmd && e.key === "s") {
      e.preventDefault();
      this.view.container.dispatchEvent(
        new CustomEvent("plotlines:save-request", { bubbles: true }),
      );
      return;
    }

    if (isCtrlOrCmd && e.key === "f") {
      e.preventDefault();
      this.showSearchWidget();
      return;
    }

    if (isCtrlOrCmd && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      this.undo();
      return;
    }

    if (isCtrlOrCmd && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      this.redo();
      return;
    }

    if (e.key === "Escape") {
      this.hideSearchWidget();
    }
  };

  handleClick({ clientPos }) {
    this.model.clearSelection();
    const { line, ch } = this.view.viewToModelPos(clientPos);
    this.model.updateCursor({ line, ch });
    this.view.render();
    this.hiddenInput.focus();
  }

  handleSetLineType(newtype) {
    this.executeCommands([
      new SetLineTypeCommand(newtype, this.model.getCursorPos()),
    ]);
  }

  handleToggleInlineStyle(style) {
    let range;
    if (this.model.hasSelection()) {
      range = this.model.getSelectionRange();
    } else if (this.model.getCursorPos()) {
      range = {
        start: this.model.getCursorPos(),
        end: this.model.getCursorPos(),
      };
    } else {
      return;
    }
    this.executeCommands([new ToggleInlineStyleCommand(style, range)]);
  }

  async handleCut() {
    if (this.model.hasSelection()) {
      const range = this.model.getSelectionRange();
      const text = this.model.getTextInRange(range);
      try {
        await navigator.clipboard.writeText(text);
        this.executeCommands([new DeleteTextCommand(range)]);
      } catch (error) {
        console.error("Cut failed:", error);
        // this.model.clearSelection();
        // this.editor.executeCommands([new DeleteTextCommand(range)]);
      }
    }
  }

  async handleCopy() {
    if (this.model.hasSelection()) {
      const range = this.model.getSelectionRange();
      const text = this.model.getTextInRange(range);
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
        const tr = [];
        if (this.model.hasSelection()) {
          const range = this.model.getSelectionRange();
          tr.push(new DeleteTextCommand(range));
        }
        tr.push(new InsertTextCommand(text, this.model.getCursorPos()));
        this.model.clearSelection();
        this.executeCommands(tr);
      }
    } catch (error) {
      console.error("Paste failed:", error);
    }
  }

  handleSearch() {
    this.showSearchWidget();
  }

  showSearchWidget() {
    this.searchWidget.classList.remove("hidden");
    this.searchWidget.querySelector(".search-input").focus();
  }

  hideSearchWidget() {
    this.searchWidget.classList.add("hidden");
    this.focusEditor();
  }

  focusEditor() {
    this.hiddenInput.focus();
    this.view.render();
  }

  // ===================================================================
  //  Plugin Management
  // ===================================================================
  registerPlugin(plugin) {
    this.plugins.push(plugin);
    if (plugin.onRegister) {
      plugin.onRegister(this);
    }
  }

  updateRemoteCursors(remoteCursors) {
    this.view.updateRemoteCursors(remoteCursors);
  }

  destroyPlugin(pluginName) {
    const pluginIndex = this.plugins.findIndex(
      (p) => p.constructor.name === pluginName,
    );
    if (pluginIndex === -1) return;

    const plugin = this.plugins[pluginIndex];
    if (plugin.destroy) {
      plugin.destroy();
    }

    this.plugins.splice(pluginIndex, 1);
  }

  dispatchEventToPlugins(eventName, data) {
    for (const plugin of this.plugins) {
      if (plugin.onEvent) {
        plugin.onEvent(eventName, data);
      }
    }
  }

  // ===================================================================
  //  Command Execution
  // ===================================================================

  // Public API for local user actions
  executeCommands(commands) {
    for (const command of commands) {
      const preState = {
        cursor: this.model.getCursorPos(),
        selection: this.model.getSelectionRange(),
      };
      const initialCursor = this.model.getCursorPos();
      command.execute(this.model);
      const rebasedCursor = transformCursorPosition(initialCursor, command);
      if (command instanceof DeleteTextCommand) {
        this.model.clearSelection();
      }
      this.model.updateCursor(rebasedCursor);
      const postState = {
        cursor: this.model.getCursorPos(),
        selection: this.model.getSelectionRange(),
      };
      this.undoManager.add(command, preState, postState);
      this.dispatchEventToPlugins("command", command);
    }
    this.view.render();
  }

  // For applying changes from remote sources, from undomanager etc, bypass adding to undo
  executeCommandsBypassUndo(commands) {
    const initialCursor = this.model.getCursorPos();
    for (const command of commands) {
      command.execute(this.model);
    }
    const finalCursor = calculateFinalCursorPosition(initialCursor, commands);
    this.model.updateCursor(finalCursor);
    this.view.render();
  }

  undo() {
    const batch = this.undoManager.getCommandsForUndo();
    if (batch) {
      for (const item of batch.reverse()) {
        const invertedCommand = item.command.invert();
        this.executeCommandsBypassUndo([invertedCommand]);
        this.dispatchEventToPlugins("command", invertedCommand);
        this.model.updateCursor(item.preState.cursor);
        this.model.setSelectionRange(item.preState.selection);
      }
    }
    this.view.render();
  }

  redo() {
    const batch = this.undoManager.getCommandsForRedo();
    if (batch) {
      for (const item of batch) {
        this.model.updateCursor(item.preState.cursor);
        this.model.setSelectionRange(item.preState.selection);
        this.executeCommandsBypassUndo([item.command]);
        this.dispatchEventToPlugins("command", item.command);
      }
      this.view.render();
    }
  }
}
