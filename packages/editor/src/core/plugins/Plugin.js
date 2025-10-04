export class Plugin {
  onRegister(editor) {
    this.editor = editor;
  }

  onEvent() {
    // Plugins should override this method to handle events
  }

  destroy() {
    // Plugins should override this method to clean up resources
  }
}
