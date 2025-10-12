// Core Editor
export { EditorController } from "./core/EditorController.js";
export { EditorModel } from "./core/EditorModel.js";
export { EditorView } from "./core/EditorView.js";
export * from "./core/commands.js";
export { UndoManager } from "./core/undoManager.js";
export * from "./core/cursor.js";

// Handlers
export { KeyboardHandler } from "./core/handlers/KeyboardHandler.js";
export { PointerHandler } from "./core/handlers/PointerHandler.js";
export { SearchHandler } from "./core/handlers/SearchHandler.js";
export { ToolbarHandler } from "./core/handlers/ToolbarHandler.js";

// Components
export { createEditorContainer } from "./components/EditorContainer/EditorContainer.js";
export { createToolbar } from "./components/Toolbar/Toolbar.js";
export { createWidgetLayer } from "./components/WidgetLayer/WidgetLayer.js";

export { createSearchWidget } from "./components/SearchWidget/SearchWidget.js";

// Plugins
export { CollabPlugin } from "./core/plugins/CollabPlugin.js";
export { Plugin } from "./core/plugins/Plugin.js";
