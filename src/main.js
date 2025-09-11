import "./style.css";
import { EditorModel } from "./editor/EditorModel.js";
import { EditorView } from "./editor/EditorView.js";
import { EditorController } from "./editor/EditorController.js";
import { FileManager } from "./editor/handlers/FileHandler.js";
import { createWidgetLayer } from "./components/WidgetLayer/WidgetLayer.js";
import { createToolbar } from "./components/Toolbar/Toolbar.js";
import { createEditorContainer } from "./components/EditorContainer/EditorContainer.js";
const app = document.querySelector("#app");

// Root wrapper
const wrapper = document.createElement("div");
wrapper.className = "editor-wrapper";

// Toolbar container
const toolbar = createToolbar();

// Widget layer
const widgetLayer = createWidgetLayer();

// Create editor area container (holds editor)
const editorArea = document.createElement("div");
editorArea.className = "editor-area";

// Editor container
const { container: editorContainer, hiddenInput } = createEditorContainer();

// Assemble editor area
editorArea.appendChild(editorContainer);
editorArea.appendChild(hiddenInput); // hidden input lives alongside container

// Assemble
wrapper.appendChild(toolbar);
wrapper.appendChild(widgetLayer);
wrapper.appendChild(editorArea);

app.appendChild(wrapper);

// Welcome text
let welcomeText =
  "Welcome to your editor!\nStart typing here.\nYou can also import files and save files\nto both browser local storage\nand your device storage.\n";

// Setup editor with generated text
const model = new EditorModel(welcomeText);

const view = new EditorView(
  model,
  editorContainer,
  widgetLayer
);
const controller = new EditorController(
  model,
  view,
  wrapper,
  toolbar,
  hiddenInput
);

// Try to load from auto-save first
if (controller.fileManager.loadFromAutoSave()) {
  console.log("Loaded from auto-save");
}

// Add focus management to editor area
editorArea.addEventListener("click", (e) => {
  // Focus the editor when clicking anywhere in the editor area
  hiddenInput.focus();
});

view.render();
