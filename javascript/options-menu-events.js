function attachOptionsMenuEvents() {
  console.log("Attaching options menu events...");

  document
    .getElementById("character-format-btn")
    .addEventListener("click", () => {
      console.log("Character format button clicked");
      // Add the character css class to the div where the mouse is currently placed or a range is selected
      const range = window.getSelection().getRangeAt(0);
      const selectedElement = range.startContainer.parentElement;
      selectedElement.classList.add("character");
      console.log(selectedElement);
      console.log(range);
    });
}

export { attachOptionsMenuEvents };
