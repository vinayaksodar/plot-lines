import { attachOptionsMenuEvents } from "./options-menu-events.js";
document.addEventListener("DOMContentLoaded", () => {
  console.log("Fetching options menu...");
  fetch("html/options-menu.html")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then((data) => {
      document.getElementById("options-menu-placeholder").innerHTML = data;
      attachOptionsMenuEvents();
    })
    .catch((error) => console.error("Error loading options menu:", error));
});
