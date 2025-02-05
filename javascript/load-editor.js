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
      requestAnimationFrame(() => {
        handleTextUnderflow();
        // Optionally, also check for overflow if needed
        // handleTextOverflow();
      });
    } else if (event.key === "Enter") {
      // Process the Enter key logic immediately if needed
      handleEnterKey(event);
      // Then on the next animation frame, handle both underflow and overflow
      requestAnimationFrame(() => {
        handleTextUnderflow();
        handleTextOverflow();
      });
    } else {
      // For other keys, if you need to handle overflow after the DOM updates
      requestAnimationFrame(() => handleTextOverflow());
    }
  });

  if (!document.querySelector(".screenplay-page")) createNewPage();
}
