function attachOptionsMenuEvents() {
  console.log("Attaching options menu events...");

  // Mapping of button IDs to the corresponding CSS class names
  const formatMappings = [
    { id: "title-format-btn", className: "title" },
    { id: "credit-format-btn", className: "credit" },
    { id: "scene-heading-format-btn", className: "scene-heading" },
    { id: "action-format-btn", className: "action" },
    { id: "character-format-btn", className: "character" },
    { id: "parenthetical-format-btn", className: "parenthetical" },
    { id: "dialogue-format-btn", className: "dialogue" },
    { id: "transition-format-btn", className: "transition" },
    { id: "shot-format-btn", className: "shot" },
  ];

  formatMappings.forEach(({ id, className }) => {
    const btn = document.getElementById(id);
    if (!btn) {
      console.warn(`Button with id ${id} not found`);
      return;
    }
    btn.addEventListener("click", () => {
      console.log(`${className} format button clicked`);
      // Add the corresponding CSS class to the div where the mouse is currently placed or a range is selected
      let selection = window.getSelection();
      if (!selection.rangeCount) {
        console.warn("No selection found");
        return;
      }
      const range = selection.getRangeAt(0);
      const selectedElement =
        range.startContainer.nodeType == Node.TEXT_NODE
          ? range.startContainer.parentElement
          : range.startContainer; //Handle case where we are in empty p element
      console.log(selectedElement);
      console.log(range);
      // Clear any previous formatting classes applied
      const allFormatClasses = formatMappings.map(
        (mapping) => mapping.className
      );
      selectedElement.classList.remove(...allFormatClasses);

      // Apply the new formatting class
      selectedElement.classList.add(className);
      selection.removeAllRanges();
      selection.addRange(range); // Set the new caret position
    });
  });
}

export { attachOptionsMenuEvents };
