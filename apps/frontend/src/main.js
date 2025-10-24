import "./style.css";
import {
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
import { createWelcomeModal } from "./components/WelcomeModal/WelcomeModal.js";
import "./components/WelcomeModal/welcomemodal.css";
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
const persistenceManager = new PersistenceManager(() =>
  titlePage.model.getData(),
);

persistenceManager.setEditorAccessors({
  getCollabPlugin: () =>
    controller.plugins.find((p) => p.constructor.name === "CollabPlugin"),
  getCursorPos: () => controller.model.getCursorPos(),
});

// --- Statistics View ---
// It needs a way to access model data, so we provide getters.
const statsViewAdapter = {
  getModel: () => model,
};
const statisticsView = createStatisticsView(statsViewAdapter);

// --- Centralized Save Handler ---
const handleSave = () => {
  const data = { lines: model.lines, titlePage: titlePage.model.getData() };
  persistenceManager.handleSaveRequest(data);
};

// --- Event and Callback Wiring ---

// 1. Listen for save requests from the editor (e.g., Ctrl+S)
editorArea.addEventListener("plotlines:save-request", handleSave);

// 2. Connect PersistenceManager events back to the Editor components
persistenceManager.on("beforeLoad", () => {
  controller.destroyPlugin("CollabPlugin");
  controller.undoManager.clear();
});

persistenceManager.on("beforeNewDocument", () => {
  controller.destroyPlugin("CollabPlugin");
  controller.undoManager.clear();
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
      triggerSnapshot: (lines, ot_version) =>
        persistenceManager.triggerAutoSnapshot(lines, ot_version),
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
      triggerSnapshot: (lines, ot_version) =>
        persistenceManager.triggerAutoSnapshot(lines, ot_version),
    });
    controller.registerPlugin(collabPlugin);
  }
  view.render();
  controller.focusEditor();
});

persistenceManager.on("focusEditor", () => controller.focusEditor());

persistenceManager.on("documentClosed", () => {
  controller.destroyPlugin("CollabPlugin");
  model.setText("");
  titlePage.model.update({});
  titlePage.render();
  view.render();
  controller.focusEditor();
  controller.undoManager.clear();
});

// --- UI Assembly ---

// 1. Create MenuBar configuration
const menuConfig = {
  File: {
    "Save File": handleSave,
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
    "Toggle Theme": () => {
      document.documentElement.classList.toggle("dark-theme");
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
        const modal = createShareModal(editorStub, new CloudPersistence());
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

// Theme is now set based on system preference

// Function to apply the system theme
function applySystemTheme() {
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.classList.add("dark-theme");
  } else {
    document.documentElement.classList.remove("dark-theme");
  }
}

// Apply theme on load
applySystemTheme();

// Listen for changes in system theme preference
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", applySystemTheme);

// --- Final Setup ---
controller.initialize(toolbar, hiddenInput, searchWidget);
editorArea.addEventListener("click", () => {
  hiddenInput.focus();
});

// Show welcome modal or file manager on startup
const visited = localStorage.getItem("plotlines_visited");
if (visited) {
  persistenceManager.manage();
} else {
  const welcomeModal = createWelcomeModal(() => {
    localStorage.setItem("plotlines_visited", "true");
    persistenceManager.manage();
  });
  document.body.appendChild(welcomeModal);
}
