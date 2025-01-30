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
        tempContainer.classList.add("screenplay-page");
        tempContainer.setAttribute("contenteditable", "true");
        document.body.appendChild(tempContainer);

        for (let i = 0; i < children.length; i++) {
          tempContainer.appendChild(children[i].cloneNode(true));
          if (tempContainer.scrollHeight > page.clientHeight) {
            overflowPoint = i;
            break;
          }
        }

        const nextPage = page.nextElementSibling || createNewPage();
        first_overflowing_node = tempContainer.removeChild(
          tempContainer.lastChild
        );
        let wordOverflowPoint = 0;
        // Check if the first overflow node is a text node and its not empty
        if (first_overflowing_node.textContent.trim() !== "") {
          // Find the number of words in the first overflow point that can still fit in the current page
          const words = first_overflowing_node.textContent.split(/\s+/);
          for (let i = 1; i <= words.length; i++) {
            //Create a new node with the first (words.length -i words) words
            const truncatedText = words.slice(0, words.length - i).join(" ");

            // Clone the original node to preserve its attributes and styles
            const newNode = first_overflowing_node.cloneNode(false);
            newNode.textContent = truncatedText;

            // Append the cloned node to the temporary container
            tempContainer.appendChild(newNode);

            // Check if the new node fits in the container
            if (tempContainer.scrollHeight <= page.clientHeight) {
              // If it fits, break the loop and keep this node
              wordOverflowPoint = i;
              break;
            } else {
              // If it doesn't fit, remove the node and try with fewer words
              tempContainer.removeChild(newNode);
            }
          }
          remaining_overflowing_node = first_overflowing_node.cloneNode(false);
          remaining_overflowing_node.textContent = words
            .slice(words.length - wordOverflowPoint, words.length)
            .join(" ");

          const fittingText = words
            .slice(0, words.length - wordOverflowPoint)
            .join(" ");
          newNode = first_overflowing_node.cloneNode(false);
          newNode.textContent = fittingText;
          page.appendChild(newNode);

          nextPage.prepend(remaining_overflowing_node);
          //Add the cursor at the end of the first overflowing node
          const range = document.createRange();
          const selection = window.getSelection();

          console.log("Focus Node:", selection.focusNode);
          console.log("Focus Node Parent:", selection.focusNode.parentNode);
          console.log("Page Last Child:", page.lastChild);

          if (page.lastChild.contains(selection.focusNode)) {
            range.selectNodeContents(nextPage.firstChild);
            range.collapse(true); // Collapse to the end of the range
            selection.removeAllRanges();
            selection.addRange(range);
          }
          // move all the nodes after the first node that overflows to the next page
          const overflowContent = children.slice(overflowPoint + 1);
          overflowContent.forEach((child) => nextPage.prepend(child));
        } else {
          overflowContent = children.slice(overflowPoint);
          overflowContent.forEach((child) => nextPage.prepend(child));
          // Create a range and select the start of the next page's content
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(nextPage);
          range.collapse(true); // Collapse to the end of the range
          selection.removeAllRanges();
          selection.addRange(range);
        }

        //REmove the overflowed nodes from the page
        page.removeChild(...children.slice(overflowPoint));
        document.body.removeChild(tempContainer);

        page.normalize();
        nextPage.normalize();

        // Find the last child node of the current page
        const lastChild = page.lastChild;

        // Focus on the next page only if cursor is on next page
        if (lastChild === document.activeElement) {
          nextPage.focus();
        }

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
