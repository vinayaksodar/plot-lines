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
          (node) =>
            node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() === ""
        );
      }

      const handleOverflow = (page) => {
        if (page.scrollHeight <= page.clientHeight) {
          return; // No overflow
        }

        const children = Array.from(page.childNodes);
        let overflowPoint = children.length;

        const tempContainer = document.createElement("div");
        tempContainer.style.position = "absolute";
        tempContainer.style.visibility = "hidden";
        document.body.appendChild(tempContainer);

        for (let i = 0; i < children.length; i++) {
          tempContainer.appendChild(children[i].cloneNode(true));
          if (tempContainer.scrollHeight > page.clientHeight) {
            overflowPoint = i;
            break;
          }
        }

        document.body.removeChild(tempContainer);

        const nextPage = page.nextElementSibling || createNewPage();
        const overflowContent = children.slice(overflowPoint);
        overflowContent.forEach((child) => nextPage.appendChild(child));

        page.normalize();
        nextPage.normalize();

        // Find the last child node of the current page
        const lastChild = page.lastChild;

        // Focus on the next page
        nextPage.focus();

        // Create a range and select the end of the next page's content
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(nextPage);
        range.collapse(false); // Collapse to the end of the range
        selection.removeAllRanges();
        selection.addRange(range);

        // Check if the current page is empty
        if (isEmpty(page)) {
          const previousPage = page.previousElementSibling;
          page.remove(); // Remove the empty page

          if (previousPage) {
            previousPage.focus();

            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(previousPage);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      };

      wrapper.addEventListener("input", () => {
        const pages = document.querySelectorAll(".screenplay-page");
        pages.forEach((page) => {
          requestAnimationFrame(() => {
            handleOverflow(page);
          });
        });
      });

      wrapper.addEventListener("keydown", (event) => {
        if (event.key === "Backspace") {
          const activePage = document.activeElement;
          if (
            activePage &&
            activePage.classList.contains("screenplay-page") &&
            activePage.previousElementSibling
          ) {
            // Backspace pressed on a non-first page
            if (isEmpty(activePage)) {
              const previousPage = activePage.previousElementSibling;
              activePage.remove(); // Remove the empty page

              if (previousPage) {
                previousPage.focus();

                const range = document.createRange();
                const selection = window.getSelection();
                range.selectNodeContents(previousPage);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
              }
            }
          }
        }
      });

      if (!document.querySelector(".screenplay-page")) {
        createNewPage();
      }
    });
});
