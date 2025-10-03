import "./sidemenu.css";

export function createSideMenu(
  titlePage,
  editorArea,
  editorWrapper,
  statisticsView,
) {
  const sideMenu = document.createElement("div");
  sideMenu.className = "side-menu";

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
    button.textContent = buttonTitle;
    button.addEventListener("click", buttons[buttonTitle]);
    sideMenu.appendChild(button);
  }

  return sideMenu;
}
