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
import { BackendManager } from "./services/BackendManager.js";
import { PersistenceManager } from "./services/PersistenceManager.js";
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
const model = new EditorModel();
const view = new EditorView(model, editorContainer, widgetLayer);
const controller = new EditorController();
const undoManager = new UndoManager();
const fileManager = new FileManager(model, view, titlePage);
const backendManager = new BackendManager(null);
const persistenceManager = new PersistenceManager(
  null,
  fileManager,
  backendManager,
);

// --- Editor Instantiation ---
const editor = new Editor({
  model,
  view,
  controller,
  undoManager,
  persistence: persistenceManager,
});

backendManager.editor = editor;
persistenceManager.editor = editor;

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
  const collabPlugin = new CollabPlugin({
    serverUrl: "ws://localhost:3000",
    backendManager,
    persistenceManager,
  });
  editor.registerPlugin(collabPlugin);
}

// --- Final Setup ---
editorArea.addEventListener("click", (e) => {
  hiddenInput.focus();
});

persistenceManager.manage();
