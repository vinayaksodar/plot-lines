document.addEventListener("DOMContentLoaded", () => {
  console.log("Fetching editor...");
  fetch("html/editor.html")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then((data) => {
      document.getElementById("editor-placeholder").innerHTML = data;

      const wrapper = document.querySelector(".screenplay-wrapper");

      // Function to create a new screenplay page
      const createNewPage = () => {
        const newPage = document.createElement("div");
        newPage.classList.add("screenplay-page");
        newPage.setAttribute("contenteditable", "true");
        newPage.innerHTML = "<p><br></p>"; // Empty paragraph to allow typing
        wrapper.appendChild(newPage);
        return newPage;
      };

      // Function to handle overflowing text
      const handleOverflow = (page) => {
        while (page.scrollHeight > page.clientHeight) {
          // Create or get the next page
          let nextPage = page.nextElementSibling;
          if (!nextPage) {
            nextPage = createNewPage();
          }

          // Find the overflowing content
          const children = Array.from(page.childNodes);
          let overflowIndex = children.length;

          // Determine which child causes the overflow
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            page.appendChild(child); // Temporarily add to measure
            if (page.scrollHeight > page.clientHeight) {
              overflowIndex = i;
              page.removeChild(child);
              break;
            }
          }

          // Move overflowing content to the next page
          const overflowContent = children.slice(overflowIndex);
          overflowContent.forEach((child) => nextPage.appendChild(child));

          page.normalize(); // Clean up empty text nodes
          nextPage.normalize(); // Clean up empty text nodes

          // Recurse for the next page
          handleOverflow(nextPage);
        }
      };

      // Event listener to monitor content changes
      wrapper.addEventListener("input", () => {
        const pages = document.querySelectorAll(".screenplay-page");
        pages.forEach((page) => handleOverflow(page));
      });

      // Initialize with the first page
      if (!document.querySelector(".screenplay-page")) {
        createNewPage();
      }
    });
});
