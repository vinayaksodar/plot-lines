import "./style.css";
import { Editor } from "./editor/Editor.js";
import { EditorModel } from "./editor/EditorModel.js";
import { EditorView } from "./editor/EditorView.js";
import { EditorController } from "./editor/EditorController.js";
import { UndoManager } from "./editor/undoManager.js";
import { FileManager } from "./services/FileHandler.js";
import { CollabPlugin } from "./editor/plugins/CollabPlugin.js";
import { createWidgetLayer } from "./components/WidgetLayer/WidgetLayer.js";
import { createToolbar } from "./components/Toolbar/Toolbar.js";
import { createEditorContainer } from "./components/EditorContainer/EditorContainer.js";
import { createMenuBar } from "./components/MenuBar/MenuBar.js";
import { createSideMenu } from "./components/SideMenu/SideMenu.js";
import { TitlePage } from "./components/TitlePage/TitlePage.js";

const app = document.querySelector("#app");

// --- UI Creation ---
const editorWrapper = document.createElement("div");
editorWrapper.className = "editor-wrapper";
const toolbar = createToolbar();
const widgetLayer = createWidgetLayer();
const editorArea = document.createElement("div");
editorArea.className = "editor-area";
const { container: editorContainer, hiddenInput } = createEditorContainer();
editorArea.appendChild(editorContainer);
editorArea.appendChild(hiddenInput);
editorWrapper.appendChild(toolbar);
editorWrapper.appendChild(widgetLayer);
editorWrapper.appendChild(editorArea);
const titlePage = new TitlePage();

// --- Editor Component Instantiation ---
const model = new EditorModel(
  "Welcome to your editor!\nStart typing here.\nYou can also import files and save files\nto both browser local storage\nand your device storage.\n"
);
const view = new EditorView(model, editorContainer, widgetLayer);
const controller = new EditorController();
const undoManager = new UndoManager();

// --- Editor Instantiation ---
const editor = new Editor({
  model,
  view,
  controller,
  undoManager,
});

// --- Initialize Components that need the Editor instance ---
const fileManager = new FileManager(editor, titlePage);
editor.fileManager = fileManager;
controller.initialize(editor, toolbar, hiddenInput);

// --- UI Assembly ---
const menuBar = createMenuBar(editor.fileManager, editor.controller);
const sideMenu = createSideMenu(titlePage, editorArea, editorWrapper);
const mainArea = document.createElement("div");
mainArea.className = "main-area";
const contentArea = document.createElement("div");
contentArea.className = "content-area";
mainArea.appendChild(sideMenu);
mainArea.appendChild(contentArea);
contentArea.appendChild(editorWrapper);
contentArea.appendChild(titlePage.element);
app.appendChild(menuBar);
app.appendChild(mainArea);

// --- Collaboration Setup ---
const useCollaboration = true;
if (useCollaboration) {
  const collabPlugin = new CollabPlugin({ serverUrl: 'ws://localhost:3000' });
  editor.registerPlugin(collabPlugin);
}

// --- Final Setup ---
if (fileManager.loadFromAutoSave()) {
  console.log("Loaded from auto-save");
}

editorArea.addEventListener("click", (e) => {
  hiddenInput.focus();
});

view.render();