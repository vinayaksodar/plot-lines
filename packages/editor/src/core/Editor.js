export class Editor {
  constructor({ model, view, controller, persistence }) {
    this.model = model;
    this.view = view;
    this.controller = controller;
    this.persistence = persistence;
  }

  focusEditor() {
    this.controller.focusEditor();
  }

  getModel() {
    return this.model;
  }

  getView() {
    return this.view;
  }

  getController() {
    return this.controller;
  }
}
