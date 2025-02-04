import { handleOverflow, handleUnderflow } from "./text-overflow.js";

export function handleTextOverflow() {
  const pages = document.querySelectorAll(".screenplay-page");
  pages.forEach((page) => {
    handleOverflow(page);
  });
}

export function handleTextUnderflow() {
  const pages = document.querySelectorAll(".screenplay-page");
  pages.forEach((page) => {
    handleUnderflow(page);
  });
}

export function handleEnterKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();

    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    // Get the parent <p> of the selection anchor node
    const currentLine =
      selection.anchorNode.tagName == "P"
        ? selection.anchorNode // Anchor node is a <p> i.e current Line has no text in it so returns the <p>
        : selection.anchorNode.parentElement; // Anchor node is text content inside a <p> but we need to get the <p>
    console.log(currentLine);

    if (!currentLine || currentLine.tagName !== "P") return;

    // Get the text content before and after the cursor
    const textBefore = currentLine.textContent.slice(0, range.startOffset);
    const textAfter = currentLine.textContent.slice(range.startOffset);

    // If the cursor is at the start of the line, ensure textBefore is an empty string
    if (range.startOffset === 0) {
      currentLine.textContent = ""; // Clear current Line
      // add a <br> tag to the current Line
      currentLine.innerHTML += "<br>";
    } else {
      currentLine.textContent = textBefore;
    }

    // Create a new Line with the remaining text
    const newLine = document.createElement("p");
    if (textAfter) {
      newLine.textContent = textAfter;
    } else {
      newLine.innerHTML = "<br>";
    }
    // Insert the new Line after the current one
    currentLine.after(newLine);

    // Move the cursor to the new Line
    selection.collapse(newLine, 0);
  }
}

export function isEmpty(element) {
  return !element.textContent.trim();
}

export function moveCursorToEnd(element) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function createNewPage() {
  const wrapper = document.querySelector(".screenplay-wrapper");
  const newPage = document.createElement("div");
  newPage.classList.add("screenplay-page");
  newPage.contentEditable = "true";
  wrapper.appendChild(newPage);
}
