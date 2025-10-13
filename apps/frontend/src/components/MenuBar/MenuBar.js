import "./menubar.css";
import { createShareModal } from "../ShareModal/ShareModal";
import { CloudPersistence } from "../../services/CloudPersistence.js";

export function createMenuBar(menuConfig) {
  const menuBar = document.createElement("div");
  menuBar.className = "menu-bar";

  const logo = document.createElement("div");
  logo.className = "logo";
  logo.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" role="img" aria-label="Plotlines icon">
  <defs>
    <style>
      .stroke { stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; fill: none; }
      .dot { fill: #facc15; }
      .stroke-fat { stroke: #facc15; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; fill: none; }
    </style>
  </defs>

  <!-- trunk -->
  <path class="stroke-fat" d="M2 12 C6 12 8 12 10 12" />

  <!-- left branch (from split at 10,12) -->
  <path class="stroke" d="M10 12 C12 10.5 13 9.5 15 8.5" />

  <!-- right branch (initial diverge) -->
  <path class="stroke-fat" d="M10 12 C12 13 13 14 14.5 15.5" />

  <!-- right branch splits into short tip (extended) -->
  <path class="stroke" d="M14.5 15.5 C16.5 16.8 18.3 17.8 20.5 18.4" />

  <!-- right branch splits into longest tip (extended further) -->
  <path class="stroke-fat" d="M14.5 15.5 C16.5 13.5 18.2 11.5 22 9" />

  <!-- node markers -->
  <circle class="dot" cx="10" cy="12" r="0.8" />
  <circle class="dot" cx="14.5" cy="15.5" r="0.8" />
  <!-- tip markers (optional) -->
  <circle class="dot" cx="15" cy="
  `;
  menuBar.appendChild(logo);

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
