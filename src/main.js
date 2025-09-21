import "./style.css";
import { EditorModel } from "./editor/EditorModel.js";
import { EditorView } from "./editor/EditorView.js";
import { EditorController } from "./editor/EditorController.js";
import { FileManager } from "./editor/handlers/FileHandler.js";
import { createWidgetLayer } from "./components/WidgetLayer/WidgetLayer.js";
import { createToolbar } from "./components/Toolbar/Toolbar.js";
import { createEditorContainer } from "./components/EditorContainer/EditorContainer.js";
import { createMenuBar } from "./components/MenuBar/MenuBar.js";
import { createSideMenu } from "./components/SideMenu/SideMenu.js";
import { TitlePage } from "./components/TitlePage/TitlePage.js";

const app = document.querySelector("#app");

// Root editorWrapper
const editorWrapper = document.createElement("div");
editorWrapper.className = "editor-wrapper";

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
editorWrapper.appendChild(toolbar);
editorWrapper.appendChild(widgetLayer);
editorWrapper.appendChild(editorArea);

// Welcome text
let welcomeText =
  "Welcome to your editor!\nStart typing here.\nYou can also import files and save files\nto both browser local storage\nand your device storage.\n";

// Setup editor with generated text
const model = new EditorModel(welcomeText);

const view = new EditorView(model, editorContainer, widgetLayer);

const controller = new EditorController(
  model,
  view,
  editorWrapper,
  toolbar,
  hiddenInput
);

// --- Create UI Components ---

// Title Page (managed by side menu)
const titlePage = new TitlePage();

// Menu Bar
const menuBar = createMenuBar(controller.fileManager, controller);

// Side Menu
const sideMenu = createSideMenu(titlePage, editorArea, editorWrapper);

// Main area for side menu and content
const mainArea = document.createElement("div");
mainArea.className = "main-area";

// Content area
const contentArea = document.createElement("div");
contentArea.className = "content-area";

// --- Assemble UI ---

mainArea.appendChild(sideMenu);
mainArea.appendChild(contentArea);
contentArea.appendChild(editorWrapper);
contentArea.appendChild(titlePage.element);

app.appendChild(menuBar);
app.appendChild(mainArea);

// Try to load from auto-save first
if (controller.fileManager.loadFromAutoSave()) {
  console.log("Loaded from auto-save");
}

// Add focus management to editor area
editorArea.addEventListener("click", (e) => {
  hiddenInput.focus();
});

view.render();
