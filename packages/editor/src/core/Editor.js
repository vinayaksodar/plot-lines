import { calculateFinalCursorPosition } from "./cursor.js";

export class Editor {
  constructor({
    model,
    view,
    controller,
    undoManager,
    persistence,
    collabManager,
  }) {
    this.model = model;
    this.view = view;
    this.controller = controller;
    this.undoManager = undoManager;
    this.persistence = persistence;
    this.collabManager = collabManager;

    // Provide a reference to the editor in each module
    if (this.model) this.model.editor = this;
    if (this.view) this.view.editor = this;
    if (this.controller) this.controller.editor = this;
    if (this.undoManager) this.undoManager.editor = this;
    if (this.persistence) this.persistence.editor = this;
    if (this.collabManager) this.collabManager.editor = this;

    this.plugins = [];
  }

  registerPlugin(plugin) {
    this.plugins.push(plugin);
    if (plugin.onRegister) {
      plugin.onRegister(this);
    }
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

  // Public API for local user actions
  executeCommands(commands) {
    const initialCursor = this.model.cursor;
    for (const command of commands) {
      command.execute(this.model);
      this.undoManager.add(command);
      this.dispatchEventToPlugins("command", command);
    }
    const finalCursor = calculateFinalCursorPosition(initialCursor, commands);
    this.model.updateCursor(finalCursor);
    this.view.render();
  }

  // For applying changes from remote sources
  executeCommandsBypassUndo(commands) {
    const initialCursor = this.model.cursor;
    for (const command of commands) {
      command.execute(this.model);
    }
    const finalCursor = calculateFinalCursorPosition(initialCursor, commands);
    this.model.updateCursor(finalCursor);
    this.view.render();
  }

  undo() {
    const commands = this.undoManager.getInvertedCommandsForUndo();
    if (commands) {
      this.executeCommands(commands);
    }
  }

  redo() {
    const commands = this.undoManager.getCommandsForRedo();
    if (commands) {
      this.executeCommands(commands);
    }
  }

  focusEditor() {
    this.controller.focusEditor();
  }

  // Getters for core components
  getModel() {
    return this.model;
  }

  getView() {
    return this.view;
  }
}
