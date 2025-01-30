import { heightOfElementWithMargin } from "./utils.js";

const createNewPage = () => {
  const newPage = document.createElement("div");
  newPage.classList.add("screenplay-page");
  newPage.setAttribute("contenteditable", "true");
  newPage.innerHTML = "<p><br></p>";
  wrapper.appendChild(newPage);
  return newPage;
};

function isEmpty(page) {
  // Check if the page contains only empty text nodes
  const childNodes = Array.from(page.childNodes);
  return childNodes.every(
    (node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() === ""
  );
}

export const handleOverflow = (page) => {
  if (page.scrollHeight <= page.clientHeight) {
    return; // No overflow
  }

  const children = Array.from(page.childNodes);
  let overflowPoint = children.length;

  let heightThatFits = 0;
  for (let i = 0; i < children.length; i++) {
    heightThatFits += heightOfElementWithMargin(children[i]); // Add height of children[i];
    if (heightThatFits > page.clientHeight) {
      overflowPoint = i;
      break;
    }
  }

  const nextPage = page.nextElementSibling || createNewPage();
  //   const range = document.createRange();
  //   const selection = window.getSelection();

  //   console.log("Focus Node:", selection.focusNode);
  //   console.log("Focus Node Parent:", selection.focusNode.parentNode);
  //   console.log("Page Last Child:", page.lastChild);

  //   if (page.lastChild.contains(selection.focusNode)) {
  //     range.selectNodeContents(nextPage.firstChild);
  //     range.collapse(true); // Collapse to the end of the range
  //     selection.removeAllRanges();
  //     selection.addRange(range);
  //   }

  let caretPosition = getCaretPosition();
  // move all the nodes that overflows to the next page
  const overflowContent = children.slice(overflowPoint);
  overflowContent.forEach((child) => nextPage.prepend(child));
  //Remove the overflowed nodes from the page
  page.removeChild(...children.slice(overflowPoint));

  setCaretPosition(caretPosition);
  page.normalize();
  nextPage.normalize();
};

function getCaretPosition() {
  let selection = window.getSelection();
  if (selection.rangeCount === 0) {
    return null; // No selection, return null if the caret is not inside any element
  }

  let range = selection.getRangeAt(0); // Get the first range (caret position)
  let rect = range.getBoundingClientRect(); // Get the position of the caret relative to the viewport

  return {
    startContainer: range.startContainer, // The node where the selection starts (could be a text node or element)
    startOffset: range.startOffset, // The character position within the node where the caret is
    rect: rect, // The position of the caret within the viewport (top, left, etc.)
    element: range.startContainer.closest("[contenteditable]"), // Find the closest editable element
  };
}

function setCaretPosition(caretPosition) {
  if (!caretPosition) return;

  let selection = window.getSelection();
  let range = document.createRange();

  // Set range to the start container and offset
  range.setStart(caretPosition.startContainer, caretPosition.startOffset);
  range.setEnd(caretPosition.startContainer, caretPosition.startOffset);

  // Collapse the range to the start (this is important to avoid text selection)
  range.collapse(true); // true collapses to the start of the range (caret position)

  selection.removeAllRanges();
  selection.addRange(range); // Set the new caret position

  // Shift focus to the element where the caret is placed
  caretPosition.element.focus();
}

// // Check if the current page is empty
// if (isEmpty(page)) {
//   const previousPage = page.previousElementSibling;
//   page.remove(); // Remove the empty page

//   if (previousPage) {
//     previousPage.focus();

//     const range = document.createRange();
//     const selection = window.getSelection();
//     range.selectNodeContents(previousPage);
//     range.collapse(false);
//     selection.removeAllRanges();
//     selection.addRange(range);
//   }
// }
