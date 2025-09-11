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
  console.log("handleUnderflow called with page:", page);
  if (!page.previousElementSibling) return; // No previous page to move content to

  const prevPage = page.previousElementSibling;
  console.log("Previous page found:", prevPage);
  const prevPageChildren = Array.from(prevPage.childNodes).filter(
    (child) => child.nodeType !== Node.TEXT_NODE
  );
  console.log("prevPageChildren:", prevPageChildren);
  const children = Array.from(page.childNodes).filter(
    (child) => child.nodeType !== Node.TEXT_NODE
  );
  console.log("Current page children:", children);
  const prevPageMaxContentHeight = contentHeightOfElement(prevPage);
  console.log("prevPageMaxContentHeight:", prevPageMaxContentHeight);
  const prevPageTotalHeightOfChildren = prevPageChildren.reduce(
    (total, child) => {
      return total + heightOfElementWithMargin(child);
    },
    0
  ); // <-- Explicitly setting initial value as 0
  console.log("prevPageTotalHeightOfChildren:", prevPageTotalHeightOfChildren);

  let availableSpace = prevPageMaxContentHeight - prevPageTotalHeightOfChildren;
  console.log("availableSpace in previous page:", availableSpace);
  let moveUpIndex = -1;
  let movedHeight = 0;

  // Determine how much content can fit in the previous page
  for (let i = 0; i < children.length; i++) {
    let childHeight = heightOfElementWithMargin(children[i]);
    console.log(
      `Child ${i} height:`,
      childHeight,
      "current movedHeight:",
      movedHeight
    );
    if (movedHeight + childHeight > availableSpace) {
      console.log("Not enough space for child", i, "stopping loop.");
      break;
    }
    movedHeight += childHeight;
    moveUpIndex = i;
    console.log(
      "After adding child",
      i,
      "movedHeight:",
      movedHeight,
      "moveUpIndex:",
      moveUpIndex
    );
  }

  // if (moveUpIndex < 0) return; // No content can be moved

  let caretPosition = getCaretPosition();
  console.log("Initial caretPosition:", caretPosition);

  // If caret position is at the start of the page, append the text of the first node of the page to the last node of the previous page and see if it fits
  if (
    children[0].contains(caretPosition.startContainer) &&
    caretPosition.startOffset === 0
  ) {
    console.log("Caret is at the start of the first child of the page.");
    const firstNode = children[0];
    const lastNode = prevPageChildren[prevPageChildren.length - 1];
    console.log("First node:", firstNode, "Last node:", lastNode);
    const firstNodeText = firstNode.textContent;
    const lastNodeText = lastNode.textContent;
    console.log("firstNodeText:", firstNodeText, "lastNodeText:", lastNodeText);
    const lastNodeHeight = heightOfElementWithMargin(lastNode);
    console.log("lastNodeHeight:", lastNodeHeight);
    const combinedText = lastNodeText + firstNodeText;
    console.log("combinedText:", combinedText);
    if (combinedText.length > 0) {
      lastNode.textContent = combinedText;
    }

    const combinedNodeHeight = Math.max(
      lastNodeHeight,
      heightOfElementWithMargin(lastNode)
    );
    console.log("combinedNodeHeight:", combinedNodeHeight);
    if (combinedNodeHeight <= availableSpace + lastNodeHeight) {
      console.log("Combined node fits in available space.");
      children.shift(); // Remove the first node from the page and from the children array
      page.removeChild(firstNode);
      //Set caret position in the last node of the previous page where the text was moved
      caretPosition = {
        startContainer: lastNode.firstChild ? lastNode.firstChild : lastNode, // Text node in the last node
        startOffset: lastNodeText.length, // Set the caret position to the end of the last node text not the end of the combined text
        rect: lastNode.getBoundingClientRect(),
        element: lastNode,
      };
      console.log(
        "Caret position set to last node of previous page:",
        caretPosition
      );
    } else {
      console.log("Combined node does not fit, moving text differently.");
      // Delete the last node from previous page and move its text to the first node of the page
      lastNode.remove();
      firstNode.textContent = combinedText;
      console.log("Last node removed. Updated first node text:", combinedText);

      //Set caret position in the first node of the current page where the text was moved
      caretPosition = {
        startContainer: firstNode.firstChild, // Text node in the last node
        startOffset: lastNodeText.length, // Set the caret position to the end of the last node text not the end of the combined text
        rect: firstNode.getBoundingClientRect(),
        element: firstNode,
      };
      console.log(
        "Caret position set to first node of current page:",
        caretPosition
      );
    }
  }

  // Move elements to the previous page
  const moveContent = children.slice(0, moveUpIndex + 1);
  console.log("Content to move to previous page:", moveContent);
  moveContent.forEach((child) => {
    page.removeChild(child);
    prevPage.appendChild(child);
    console.log("Moved child:", child);
  });

  setCaretPosition(caretPosition);
  console.log("Caret position set:", caretPosition);
  // page.normalize();
  // prevPage.normalize();

  // If the current page is empty after moving content, remove it
  if (isEmpty(page)) {
    console.log("Current page is empty, cleaning and removing it.");
    cleanEmptyParagraphs(page);
    page.remove();
  } else {
    console.log("Current page is not empty after underflow handling.");
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
