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

      // Select the screenplay wrapper
      const wrapper = document.querySelector(".screenplay-wrapper");

      // Function to create a new screenplay page
      const createNewPage = () => {
        const newPage = document.createElement("div");
        newPage.classList.add("screenplay-page");
        newPage.setAttribute("contenteditable", "true");
        newPage.innerHTML = "<h1>New Scene</h1><p>Start typing...</p>";
        wrapper.appendChild(newPage);
      };

      // Function to check if the user has run out of space
      const checkOverflow = () => {
        const pages = document.querySelectorAll(".screenplay-page");
        const lastPage = pages[pages.length - 1];

        if (lastPage.scrollHeight > lastPage.clientHeight) {
          createNewPage();
        }
      };

      // Listen for input events to detect when to add a new page
      wrapper.addEventListener("input", () => {
        checkOverflow();
      });
    });
});
