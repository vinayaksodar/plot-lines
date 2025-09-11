// JavaScript to handle menu clicks (app.js)

// DOM elements
const docTitle = document.getElementById("doc-title");
const fileMenu = document.getElementById("file-menu");
const editMenu = document.getElementById("edit-menu");
const viewMenu = document.getElementById("view-menu");

// Event Listeners for Menu Items
fileMenu.addEventListener("click", () => {
  alert("File menu clicked");
  // Future functionality to open files, save, etc.
});

editMenu.addEventListener("click", () => {
  alert("Edit menu clicked");
  // Future functionality for edit operations (cut, copy, paste, etc.)
});

viewMenu.addEventListener("click", () => {
  alert("View menu clicked");
  // Future functionality to change view (dark mode, layout changes, etc.)
});

// You can also dynamically change the document title (for example)
function changeDocumentTitle(newTitle) {
  docTitle.textContent = newTitle;
}

// Example of changing the document title
setTimeout(() => {
  changeDocumentTitle("My Collaborative Document");
}, 3000);
