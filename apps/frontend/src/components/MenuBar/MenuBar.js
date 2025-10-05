import "./menubar.css";
import { createShareModal } from "../ShareModal/ShareModal";
import { CloudPersistence } from "../../services/CloudPersistence.js";

export function createMenuBar(persistence, editorController) {
  const menuBar = document.createElement("div");
  menuBar.className = "menu-bar";

  const menus = {
    File: {
      // 'Open File': () => persistence.import(),
      "Save File": () => persistence.save(),
      Rename: () => persistence.rename(),
      // 'Export File': () => persistence.export(),
      hr1: "hr",
      "Import Fountain": () => persistence.import("fountain"),
      "Export Fountain": () => persistence.export("fountain"),
      hr2: "hr",
      "Manage Files": () => persistence.manage(),
    },
    Edit: {
      Undo: () => editorController.handleUndo(),
      Redo: () => editorController.handleRedo(),
      hr1: "hr",
      Cut: () => editorController.handleCut(),
      Copy: () => editorController.handleCopy(),
      Paste: () => editorController.handlePaste(),
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
        if (persistence.editor.isCloudDocument) {
          const modal = createShareModal(
            persistence.editor,
            new CloudPersistence(persistence.editor),
          );
          document.body.appendChild(modal);
        } else {
          persistence.showToast(
            "Manage access is only for cloud documents",
            "error",
          );
        }
      },
    },
  };

  for (const menuTitle in menus) {
    const menuContainer = document.createElement("div");
    menuContainer.className = "menu";

    const button = document.createElement("button");
    button.textContent = menuTitle;
    menuContainer.appendChild(button);

    const dropdown = document.createElement("div");
    dropdown.className = "menu-dropdown";
    menuContainer.appendChild(dropdown);

    for (const itemTitle in menus[menuTitle]) {
      if (menus[menuTitle][itemTitle] === "hr") {
        const hr = document.createElement("hr");
        dropdown.appendChild(hr);
        continue;
      }
      const item = document.createElement("a");
      item.href = "#";
      item.textContent = itemTitle;
      item.addEventListener("click", (e) => {
        e.preventDefault();
        menus[menuTitle][itemTitle]();
        dropdown.classList.remove("visible");
      });
      dropdown.appendChild(item);
    }

    button.addEventListener("click", () => {
      closeAllMenus();
      dropdown.classList.toggle("visible");
    });

    menuBar.appendChild(menuContainer);
  }

  function closeAllMenus() {
    menuBar
      .querySelectorAll(".menu-dropdown")
      .forEach((d) => d.classList.remove("visible"));
  }

  document.addEventListener("click", (e) => {
    if (!menuBar.contains(e.target)) {
      closeAllMenus();
    }
  });

  return menuBar;
}
