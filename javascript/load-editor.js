import {
  handleTextOverflow,
  handleTextUnderflow,
  handleEnterKey,
} from "./editor-events.js";
document.addEventListener("DOMContentLoaded", () => {
  console.log("Fetching editor...");
  fetch("html/editor.html")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then((data) => {
      document.getElementById("editor-placeholder").innerHTML = data;

      initializeEditor();
    });
});

function initializeEditor() {
  const wrapper = document.querySelector(".screenplay-wrapper");

  // Handle keydown events (Backspace, Delete, Enter)
  wrapper.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" || event.key === "Delete") {
      requestAnimationFrame(() => handleTextUnderflow());
    } else if (event.key === "Enter") {
      handleEnterKey(event);
      requestAnimationFrame(() => handleTextOverflow());
    } else {
      handleTextOverflow();
    }
  });

  if (!document.querySelector(".screenplay-page")) createNewPage();
}
