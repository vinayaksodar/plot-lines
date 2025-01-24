// header.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("Fetching header...");
  fetch("html/header.html")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then((data) => {
      document.getElementById("header-placeholder").innerHTML = data;

      // Select the document name element using querySelector
      const docTitleElement = document.querySelector(".doc-title");

      // Add a double-click event listener
      docTitleElement.addEventListener("dblclick", editDocumentName);

      function editDocumentName() {
        // Create input field for editing
        const input = document.createElement("input");
        input.type = "text";
        input.value = docTitleElement.textContent;
        const oldName = docTitleElement.textContent;

        // Replace the document name text with the input
        docTitleElement.innerHTML = ""; // Clear existing content
        docTitleElement.appendChild(input); // Add input element

        // Focus on the input field
        input.focus();

        // Listen for 'blur' (click outside the input) to save the new name
        input.addEventListener("blur", () => {
          docTitleElement.innerHTML = input.value || oldName; // Default to the old name if empty
        });

        // Optionally, listen for the 'Enter' key to save immediately
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            docTitleElement.innerHTML = input.value || oldName; // Save the name
          }
        });
      }
    })
    .catch((error) => console.error("Error loading header:", error));
});
