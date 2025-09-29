import "./style.css";
import {
  Editor,
  EditorModel,
  EditorView,
  EditorController,
  UndoManager,
  createWidgetLayer,
  createToolbar,
  createEditorContainer,
  CollabPlugin,
} from "@plot-lines/editor";
import { TitlePage } from "./components/TitlePage/TitlePage.js";
import { FileManager } from "./services/FileManager.js";
import { createSideMenu } from "./components/SideMenu/SideMenu.js";
import { createMenuBar } from "./components/MenuBar/MenuBar.js";

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
const fileManager = new FileManager(model, view, titlePage);

// --- Editor Instantiation ---
const editor = new Editor({
  model,
  view,
  controller,
  undoManager,
  persistence: fileManager,
});

// --- Initialize Components that need the Editor instance ---
controller.initialize(editor, toolbar, hiddenInput);

// --- UI Assembly ---
const menuBar = createMenuBar(editor.persistence, editor.controller);
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
  const collabPlugin = new CollabPlugin({ serverUrl: "ws://localhost:3000" });
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
