import "./sidemenu.css";

export function createSideMenu(
  titlePage,
  editorArea,
  editorWrapper,
  statisticsView,
) {
  const sideMenu = document.createElement("div");
  sideMenu.className = "side-menu";

  const buttonInfo = {
    Editor: {
      tooltip: "Editor",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>',
    },
    "Title Page": {
      tooltip: "Title Page",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6h12M12 6v12"></path></svg>',
    },
    Statistics: {
      tooltip: "Statistics",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10M18 20V4M6 20V16"></path></svg>',
    },
  };

  const buttons = {
    Editor: () => {
      titlePage.hide();
      statisticsView.hide();
      editorWrapper.style.display = "flex";
    },
    "Title Page": () => {
      editorWrapper.style.display = "none";
      statisticsView.hide();
      titlePage.show();
    },
    Statistics: () => {
      titlePage.hide();
      editorWrapper.style.display = "none";
      statisticsView.show();
    },
  };

  for (const buttonTitle in buttons) {
    const button = document.createElement("button");
    button.className = "sidemenu-button";
    button.innerHTML = buttonInfo[buttonTitle].svg;
    button.title = buttonInfo[buttonTitle].tooltip;

    if (buttonTitle === "Editor") {
      button.classList.add("selected");
    }

    button.addEventListener("click", () => {
      buttons[buttonTitle]();
      sideMenu
        .querySelectorAll(".sidemenu-button")
        .forEach((btn) => btn.classList.remove("selected"));
      button.classList.add("selected");
    });
    sideMenu.appendChild(button);
  }

  const bottomContainer = document.createElement("div");
  bottomContainer.className = "sidemenu-bottom";

  const bottomButtons = [
    {
      tooltip: "Join our Discord",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" stroke-width="2" 
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M7.2 19.2c-.64.94-1.36 1.88-2.1 2.7C2.5 21.8 1 19 1 19c.07-4.8 1.24-9.5 3.4-13.7A10 10 0 0 1 8.9 4l.7 1.6a17 17 0 0 1 5.8 0L16.2 4a10 10 0 0 1 4.5 1.3c2.2 4.2 3.3 8.9 3.4 13.7 0 0-1.5 2.8-4.1 2.9-.74-.82-1.46-1.76-2.1-2.7m2.8-2.1c-2.7 1.4-5.3 2.8-9.3 2.8s-6.6-1.4-9.3-2.8"></path>
      <path d="M8.8 13a2 2 0 0 1 4 0"></path>
      <path d="M14.8 13a2 2 0 0 1 4 0"></path>
    </svg>`,
      handler: () => window.open("https://discord.gg/9XpS2J4C", "_blank"),
    },
    {
      tooltip: "Settings",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" stroke-width="2" 
      stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 
        2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 
        1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 
        1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 
        1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 
        2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 
        1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 
        2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 
        1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 
        2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 
        1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 
        1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 
        2 2v.09a1.65 1.65 0 0 0 1 
        1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 
        2 0 0 1 2.83 0 2 2 0 0 1 0 
        2.83l-.06.06a1.65 1.65 0 0 0-.33 
        1.82V9a1.65 1.65 0 0 0 
        1.51 1H21a2 2 0 0 1 2 2 
        2 2 0 0 1-2 2h-.09a1.65 
        1.65 0 0 0-1.51 1z"></path>
    </svg>`,
      handler: () => console.log("Settings button clicked"),
    },
  ];

  bottomButtons.forEach((config) => {
    const button = document.createElement("button");
    button.className = "sidemenu-button";
    button.innerHTML = config.svg;
    button.title = config.tooltip;
    button.addEventListener("click", config.handler);
    bottomContainer.appendChild(button);
  });

  sideMenu.appendChild(bottomContainer);

  return sideMenu;
}
// //editor
// <svg version="1.1" id="Uploaded to svgrepo.com" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="256px" height="256px" viewBox="0 0 32 32" xml:space="preserve" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <style type="text/css"> .bentblocks_een{fill:#0B1719;} </style> <path class="bentblocks_een" d="M28,4v2H4V4H28z M4,10h24v4.471l-7.172,7.172l3.529,3.529L28,21.529v2.828L24.358,28H18v-4H4v-2h14 v-0.358L21.642,18H4v-2h19.642l4-4H4V10z M20,23.642V26h2.358L20,23.642z"></path> </g></svg<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M1 22C1 21.4477 1.44772 21 2 21H22C22.5523 21 23 21.4477 23 22C23 22.5523 22.5523 23 22 23H2C1.44772 23 1 22.5523 1 22Z" fill="#0F0F0F"></path> <path fill-rule="evenodd" clip-rule="evenodd" d="M18.3056 1.87868C17.1341 0.707107 15.2346 0.707107 14.063 1.87868L3.38904 12.5526C2.9856 12.9561 2.70557 13.4662 2.5818 14.0232L2.04903 16.4206C1.73147 17.8496 3.00627 19.1244 4.43526 18.8069L6.83272 18.2741C7.38969 18.1503 7.89981 17.8703 8.30325 17.4669L18.9772 6.79289C20.1488 5.62132 20.1488 3.72183 18.9772 2.55025L18.3056 1.87868ZM15.4772 3.29289C15.8677 2.90237 16.5009 2.90237 16.8914 3.29289L17.563 3.96447C17.9535 4.35499 17.9535 4.98816 17.563 5.37868L15.6414 7.30026L13.5556 5.21448L15.4772 3.29289ZM12.1414 6.62869L4.80325 13.9669C4.66877 14.1013 4.57543 14.2714 4.53417 14.457L4.0014 16.8545L6.39886 16.3217C6.58452 16.2805 6.75456 16.1871 6.88904 16.0526L14.2272 8.71448L12.1414 6.62869Z" fill="#0F0F0F"></path> </g></svg>

// // Title page
// <svg width="256px" height="256px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 6V19M6 6H18" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>

// // STats
// <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <rect x="0" fill="none" width="24" height="24"></rect> <g> <path d="M8.143 15.857H5.57V9.43h2.573v6.427zM13.286 15.857h-2.572V3h2.572v12.857zM18.428 15.857h-2.57v-9h2.57v9z"></path> <path fill-rule="evenodd" clip-rule="evenodd" d="M21 20.714H3v-2h18v2z"></path> </g> </g></svg>
