import "./style.css";
import {
  Editor,
  EditorModel,
  EditorView,
  EditorController,
  UndoManager,
  CollabPlugin,
  createWidgetLayer,
  createToolbar,
  createEditorContainer,
  createSearchWidget,
} from "@plot-lines/editor";
import { TitlePage } from "./components/TitlePage/TitlePage.js";
import { PersistenceManager } from "./services/PersistenceManager.js";
import { createSideMenu } from "./components/SideMenu/SideMenu.js";
import { createMenuBar } from "./components/MenuBar/MenuBar.js";
import { createStatisticsView } from "./components/StatisticsView/StatisticsView.js";
import { createShareModal } from "./components/ShareModal/ShareModal.js";
import { CloudPersistence } from "./services/CloudPersistence.js";

const app = document.querySelector("#app");

// --- UI Creation ---
const editorWrapper = document.createElement("div");
editorWrapper.className = "editor-wrapper";
const toolbar = createToolbar();
const widgetLayer = createWidgetLayer();
const searchWidget = createSearchWidget();
const editorArea = document.createElement("div");
editorArea.className = "editor-area";
const { container: editorContainer, hiddenInput } = createEditorContainer();
editorContainer.appendChild(widgetLayer);
editorArea.appendChild(editorContainer);
editorWrapper.appendChild(toolbar);
editorWrapper.appendChild(searchWidget);
editorWrapper.appendChild(editorArea);
editorWrapper.appendChild(hiddenInput);
const titlePage = new TitlePage();

// --- Core Component Instantiation ---
const model = new EditorModel();
const view = new EditorView(model, editorContainer, widgetLayer);
const undoManager = new UndoManager();
const controller = new EditorController({ model, view, undoManager });
const persistenceManager = new PersistenceManager(() => titlePage.model.getData());

persistenceManager.setEditorAccessors({
  getCollabPlugin: () => controller.plugins.find(p => p.constructor.name === "CollabPlugin"),
  getCursorPos: () => controller.model.getCursorPos(),
});

// --- Main Editor Object (as a container) ---
// This is now primarily a namespace to hold the core modules.
const editor = new Editor({
  model,
  view,
  controller,
  persistence: persistenceManager,
});

// --- Statistics View ---
// It needs a way to access model data, so we provide getters.
const statsViewAdapter = {
  getModel: () => model,
};
const statisticsView = createStatisticsView(statsViewAdapter);


// --- Event and Callback Wiring ---

// 1. Connect Save action from Controller to PersistenceManager
controller.onSaveRequest((data) => persistenceManager.handleSaveRequest(data));

// 2. Connect PersistenceManager events back to the Editor components
persistenceManager.on("beforeLoad", () => {
  controller.destroyPlugin("CollabPlugin");
});

persistenceManager.on("beforeNewDocument", () => {
  controller.destroyPlugin("CollabPlugin");
});

persistenceManager.on("documentLoaded", (data) => {
  if (data.lines && data.lines.length > 0) {
    model.lines = data.lines;
  } else {
    model.setText("");
  }
  if (data.titlePage) {
    titlePage.model.update(data.titlePage);
    titlePage.render();
  }


  if (data.isCloud) {
    const collabPlugin = new CollabPlugin({
      userID: data.user.id,
      userMap: new Map(),
      ot_version: data.ot_version || 0,
    });
    controller.registerPlugin(collabPlugin);

  }

  view.render();
  controller.focusEditor();
});

persistenceManager.on("documentCreated", (data) => {
  model.setText("");
  titlePage.model.update({});
  titlePage.render();
  if (data.isCloud) {
      const collabPlugin = new CollabPlugin({
        userID: data.user.id,
        userMap: new Map([[data.user.id, data.user.email]]),
        ot_version: 0,
      });
      controller.registerPlugin(collabPlugin);

  }
  view.render();
  controller.focusEditor();
});

persistenceManager.on("focusEditor", () => controller.focusEditor());


// --- UI Assembly ---

// 1. Create MenuBar configuration
const menuConfig = {
  File: {
    "Save File": () => controller.triggerSave(),
    Rename: () => persistenceManager.rename(),
    hr1: "hr",
    "Import Fountain": () => persistenceManager.import("fountain"),
    "Export Fountain": () => {
      const data = { lines: model.lines, titlePage: titlePage.model.getData() };
      persistenceManager.export("fountain", data);
    },
    hr2: "hr",
    "Manage Files": () => persistenceManager.manage(),
  },
  Edit: {
    Undo: () => controller.undo(),
    Redo: () => controller.redo(),
    hr1: "hr",
    Cut: () => controller.handleCut(),
    Copy: () => controller.handleCopy(),
    Paste: () => controller.handlePaste(),
  },
  View: {
    "Toggle Toolbar": () => {
      const toolbar = document.querySelector(".iconbar");
      if (toolbar) {
        toolbar.classList.toggle("hidden");
      }
    },
  },
  Share: {
    "Manage access": () => {
      if (persistenceManager.isCloudDocument) {
        const collabPlugin = controller.plugins.find(
          (p) => p.constructor.name === "CollabPlugin",
        );
        const editorStub = {
          documentId: persistenceManager.documentId,
          collab: collabPlugin,
        };
        const modal = createShareModal(
          editorStub,
          new CloudPersistence(),
        );
        document.body.appendChild(modal);
      } else {
        persistenceManager.showToast(
          "Manage access is only for cloud documents",
          "error",
        );
      }
    },
  },
};

// 2. Create UI Components
const menuBar = createMenuBar(menuConfig);
const sideMenu = createSideMenu(
  titlePage,
  editorArea,
  editorWrapper,
  statisticsView,
);

// 3. Assemble App Layout
const mainArea = document.createElement("div");
mainArea.className = "main-area";
const contentArea = document.createElement("div");
contentArea.className = "content-area";
mainArea.appendChild(sideMenu);
mainArea.appendChild(contentArea);
contentArea.appendChild(editorWrapper);
contentArea.appendChild(titlePage.element);
contentArea.appendChild(statisticsView.element);
app.appendChild(menuBar);
app.appendChild(mainArea);

// --- Final Setup ---
controller.initialize(toolbar, hiddenInput, searchWidget);
editorArea.addEventListener("click", () => {
  hiddenInput.focus();
});

// Show file manager on startup
persistenceManager.manage();
