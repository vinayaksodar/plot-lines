import "./menubar.css";

export function createMenuBar(fileManager, editorController) {
  const menuBar = document.createElement("div");
  menuBar.className = "menu-bar";

  const menus = {
    File: {
      "New File": () => fileManager.handleNewFile(),
      // 'Open File': () => fileManager.handleOpenFile(),
      "Save File": () => fileManager.handleSaveFile(),
      // 'Export File': () => fileManager.handleExportFile(),
      hr1: "hr",
      "Import Fountain": () => fileManager.handleImportFountain(),
      "Export Fountain": () => fileManager.handleExportFountain(),
      hr2: "hr",
      "Manage Files": () => fileManager.handleManageFiles(),
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
    Insert: {
      "Dummy Action": () => {},
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
