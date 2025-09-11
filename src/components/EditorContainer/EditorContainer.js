// editor/EditorContainer/EditorContainer.js
import "./editorcontainer.css";

export function createEditorContainer() {
  // Display surface
  const container = document.createElement("div");
  container.className = "editor-container";
  container.id = "editor-container";

  // Hidden input for text entry (desktop + mobile)
  const hiddenInput = document.createElement("input");
  hiddenInput.type = "text";
  hiddenInput.autocomplete = "off";
  hiddenInput.autocorrect = "off";
  hiddenInput.autocapitalize = "off";
  hiddenInput.spellcheck = false;
  hiddenInput.style.position = "absolute";
  hiddenInput.style.opacity = "0";
  hiddenInput.style.left = "-9999px";
  hiddenInput.style.height = "0";
  hiddenInput.style.width = "0";

  return { container, hiddenInput };
}
