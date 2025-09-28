export class Editor {
  constructor({ model, view, controller, undoManager, fileManager, collabManager }) {
    this.model = model;
    this.view = view;
    this.controller = controller;
    this.undoManager = undoManager;
    this.fileManager = fileManager;
    this.collabManager = collabManager;

    // Provide a reference to the editor in each module
    if (this.model) this.model.editor = this;
    if (this.view) this.view.editor = this;
    if (this.controller) this.controller.editor = this;
    if (this.undoManager) this.undoManager.editor = this;
    if (this.fileManager) this.fileManager.editor = this;
    if (this.collabManager) this.collabManager.editor = this;

    this.plugins = [];
  }

  registerPlugin(plugin) {
    this.plugins.push(plugin);
    if (plugin.onRegister) {
      plugin.onRegister(this);
    }
  }

  dispatch(eventName, data) {
    for (const plugin of this.plugins) {
      if (plugin.onEvent) {
        plugin.onEvent(eventName, data);
      }
    }
  }

  // Public API for local user actions
  executeCommand(command) {
    command.execute(this.model);
    this.undoManager.add(command);
    this.dispatch('command', command);
    this.view.render();
  }

  // For applying changes from remote sources
  applyRemoteCommand(command) {
    command.execute(this.model);
    // For now, we clear the undo history on remote changes for simplicity.
    // A more advanced implementation would rebase the undo stack.
    this.undoManager.clear(); 
    this.view.render();
  }

  undo() {
    const commands = this.undoManager.getInvertedCommandsForUndo();
    if (commands) {
      commands.forEach(cmd => this.executeCommand(cmd));
    }
  }

  redo() {
    const commands = this.undoManager.getCommandsForRedo();
    if (commands) {
      commands.forEach(cmd => this.executeCommand(cmd));
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
