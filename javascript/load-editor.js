import { handleOverflow } from "./text-overflow.js";

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

      const wrapper = document.querySelector(".screenplay-wrapper");

      wrapper.addEventListener("input", () => {
        const pages = document.querySelectorAll(".screenplay-page");
        pages.forEach((page) => {
          requestAnimationFrame(() => {
            handleOverflow(page);
          });
        });
      });

      wrapper.addEventListener("keydown", (event) => {
        if (event.key === "Backspace") {
          const activePage = document.activeElement;
          if (
            activePage &&
            activePage.classList.contains("screenplay-page") &&
            activePage.previousElementSibling
          ) {
            // Backspace pressed on a non-first page
            if (isEmpty(activePage)) {
              const previousPage = activePage.previousElementSibling;
              activePage.remove(); // Remove the empty page

              if (previousPage) {
                previousPage.focus();

                const range = document.createRange();
                const selection = window.getSelection();
                range.selectNodeContents(previousPage);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
              }
            }
          }
        }
      });

      if (!document.querySelector(".screenplay-page")) {
        createNewPage();
      }
    });
});
