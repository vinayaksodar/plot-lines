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
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>',
    },
    "Title Page": {
      tooltip: "Title Page",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6h12M12 6v12"></path></svg>',
    },
    Statistics: {
      tooltip: "Statistics",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10M18 20V4M6 20V16"></path></svg>',
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
      tooltip: "GitHub",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
      </svg>`,
      handler: () => window.open("https://github.com/your-repo", "_blank"),
    },
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
