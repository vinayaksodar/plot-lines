function attachOptionsMenuEvents() {
  console.log("Attaching options menu events...");

  document
    .getElementById("character-format-btn")
    .addEventListener("click", () => {
      console.log("Character format button clicked");
      // Add the character css class to the div where the mouse is currently placed or a range is selected
      let selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const selectedElement = range.startContainer.parentElement;
      selectedElement.classList.add("character");
      console.log(selectedElement);
      console.log(range);
      selection.removeAllRanges();
      selection.addRange(range); // Set the new caret position
    });
}

export { attachOptionsMenuEvents };
