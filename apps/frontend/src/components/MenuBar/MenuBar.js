import "./menubar.css";
import { createShareModal } from "../ShareModal/ShareModal";
import { CloudPersistence } from "../../services/CloudPersistence.js";

export function createMenuBar(menuConfig) {
  const menuBar = document.createElement("div");
  menuBar.className = "menu-bar";

  for (const menuTitle in menuConfig) {
    const menuContainer = document.createElement("div");
    menuContainer.className = "menu";

    const button = document.createElement("button");
    button.textContent = menuTitle;
    menuContainer.appendChild(button);

    const dropdown = document.createElement("div");
    dropdown.className = "menu-dropdown";
    menuContainer.appendChild(dropdown);

    for (const itemTitle in menuConfig[menuTitle]) {
      if (menuConfig[menuTitle][itemTitle] === "hr") {
        const hr = document.createElement("hr");
        dropdown.appendChild(hr);
        continue;
      }
      const item = document.createElement("a");
      item.href = "#";
      item.textContent = itemTitle;
      item.addEventListener("click", (e) => {
        e.preventDefault();
        menuConfig[menuTitle][itemTitle]();
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
