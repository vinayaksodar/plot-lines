import {
  heightOfElementWithMargin,
  widthOfElementWithMargin,
  contentHeightOfElement,
} from "./utils.js";

const createNewPage = () => {
  const wrapper = document.querySelector(".screenplay-wrapper");
  const newPage = document.createElement("div");
  newPage.classList.add("screenplay-page");
  newPage.setAttribute("contenteditable", "true");
  // newPage.innerHTML = "<p><br></p>";
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

  const children = Array.from(page.childNodes).filter(
    (child) => child.nodeType !== Node.TEXT_NODE
  );

  let overflowPoint = children.length;

  let pageContentHeight = contentHeightOfElement(page);
  let heightThatFits = 0;
  for (let i = 0; i < children.length; i++) {
    heightThatFits += heightOfElementWithMargin(children[i]); // Add height of children[i];
    // console.log(
    //   "height of children[i]",
    //   heightOfElementWithMargin(children[i])
    // );
    if (heightThatFits > pageContentHeight) {
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
  // Remove the overflowed nodes from the page first
  const overflowContent = children.slice(overflowPoint);
  overflowContent.forEach((child) => {
    if (page.contains(child)) {
      page.removeChild(child);
    }
  });

  // Now move the nodes to the next page
  overflowContent.forEach((child) => nextPage.prepend(child));
  setCaretPosition(caretPosition);
  // page.normalize();
  // nextPage.normalize();
};
function getCaretPosition() {
  let selection = window.getSelection();
  if (selection.rangeCount === 0) {
    console.warn("getCaretPosition: No selection found.");
    return null; // No selection, return null if the caret is not inside any element
  }

  let range = selection.getRangeAt(0); // Get the first range (caret position)
  let rect = range.getBoundingClientRect(); // Get the position of the caret relative to the viewport

  console.log("getCaretPosition: Captured caret details", {
    startContainer: range.startContainer,
    startOffset: range.startOffset,
    rect,
    commonAncestor: range.commonAncestorContainer,
  });

  return {
    startContainer: range.startContainer, // The node where the selection starts (could be a text node or element)
    startOffset: range.startOffset, // The character position within the node where the caret is
    rect: rect, // The position of the caret within the viewport (top, left, etc.)
    element: range.commonAncestorContainer, // The element where the caret is
  };
}

export const handleUnderflow = (page) => {
  if (!page.previousElementSibling) return; // No previous page to move content to

  const prevPage = page.previousElementSibling;
  const prevPageChildren = Array.from(prevPage.childNodes).filter(
    (child) => child.nodeType !== Node.TEXT_NODE
  );
  const children = Array.from(page.childNodes).filter(
    (child) => child.nodeType !== Node.TEXT_NODE
  );
  const prevPageMaxContentHeight = contentHeightOfElement(prevPage);
  const prevPageTotalHeightOfChildren = prevPageChildren.reduce(
    (total, child) => {
      return total + heightOfElementWithMargin(child);
    },
    0
  ); // <-- Explicitly setting initial value as 0

  let availableSpace = prevPageMaxContentHeight - prevPageTotalHeightOfChildren;
  let moveUpIndex = -1;
  let movedHeight = 0;

  // Determine how much content can fit in the previous page
  for (let i = 0; i < children.length; i++) {
    let childHeight = heightOfElementWithMargin(children[i]);
    if (movedHeight + childHeight > availableSpace) break;
    movedHeight += childHeight;
    moveUpIndex = i;
  }

  // if (moveUpIndex < 0) return; // No content can be moved

  let caretPosition = getCaretPosition();

  // If caret position is at the start of the page, append the text of the first node of the page to the last node of the previous page and see if it fits
  if (
    children[0].contains(caretPosition.startContainer) &&
    caretPosition.startOffset === 0
  ) {
    const firstNode = children[0];
    const lastNode = prevPageChildren[prevPageChildren.length - 1];
    const firstNodeText = firstNode.textContent;
    const lastNodeText = lastNode.textContent;
    const lastNodeHeight = heightOfElementWithMargin(lastNode);
    const combinedText = lastNodeText + firstNodeText;
    lastNode.textContent = combinedText;
    const combinedNodeHeight = heightOfElementWithMargin(lastNode);
    if (combinedNodeHeight <= availableSpace - lastNodeHeight) {
      children.shift(); // Remove the first node from the page
      moveUpIndex = 0;
      //Set caret position in the last node of the previous page where the text was moved
      caretPosition = {
        startContainer: lastNode,
        startOffset: lastNodeText.length, // Set the caret position to the end of the last node text not the end of the combined text
        rect: lastNode.getBoundingClientRect(),
        element: lastNode,
      };
    } else {
      // Delete the last node from previous page and move its text to the first node of the page
      lastNode.remove();
      firstNode.textContent = combinedText;
    }
  }

  // Move elements to the previous page
  const moveContent = children.slice(0, moveUpIndex + 1);
  moveContent.forEach((child) => {
    page.removeChild(child);
    prevPage.appendChild(child);
  });

  setCaretPosition(caretPosition);
  // page.normalize();
  // prevPage.normalize();

  // If the current page is empty after moving content, remove it
  if (isEmpty(page)) {
    cleanEmptyParagraphs(page);
    page.remove();
  }
};

// Helper function to remove empty <p> elements
function cleanEmptyParagraphs(page) {
  const paragraphs = page.querySelectorAll("p");
  paragraphs.forEach((p) => {
    if (p.innerHTML.trim() === "" || p.innerHTML === "<br>") {
      p.remove();
    }
  });
}

function setCaretPosition(caretPosition) {
  if (!caretPosition) {
    console.warn("setCaretPosition: Caret position is null, cannot restore.");
    return;
  }

  let selection = window.getSelection();
  let range = document.createRange();

  console.log("setCaretPosition: Attempting to restore caret", caretPosition);

  try {
    // Ensure the startContainer is still in the DOM
    if (!document.body.contains(caretPosition.startContainer)) {
      console.error(
        "setCaretPosition: The original startContainer is no longer in the document."
      );
      return;
    }

    // Set range to the start container and offset
    range.setStart(caretPosition.startContainer, caretPosition.startOffset);
    range.setEnd(caretPosition.startContainer, caretPosition.startOffset);

    // Collapse the range to the start (this is important to avoid text selection)
    range.collapse(true); // true collapses to the start of the range (caret position)

    selection.removeAllRanges();
    selection.addRange(range); // Set the new caret position
    console.log("setCaretPosition: Caret successfully restored.");

    // Shift focus to the first parent of node type 1
    let parent = caretPosition.element;
    while (parent && parent.nodeType !== 1) {
      parent = parent.parentNode;
    }

    if (parent) {
      parent.focus();
      console.log("setCaretPosition: Focus shifted to parent element", parent);
    } else {
      console.warn("setCaretPosition: No valid parent element to focus on.");
    }
  } catch (error) {
    console.error("setCaretPosition: Error setting caret position", error);
  }
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
