import './sidemenu.css';

export function createSideMenu(titlePage, editorArea, editorWrapper) {
  const sideMenu = document.createElement('div');
  sideMenu.className = 'side-menu';

  const buttons = {
    Editor: () => {
      titlePage.hide();
      editorWrapper.style.display = 'flex';
    },
    'Title Page': () => {
      editorWrapper.style.display = 'none';
      titlePage.show();
    },
    Statistics: () => {
      // Dummy action
      alert('Statistics coming soon!');
    },
  };

  for (const buttonTitle in buttons) {
    const button = document.createElement('button');
    button.textContent = buttonTitle;
    button.addEventListener('click', buttons[buttonTitle]);
    sideMenu.appendChild(button);
  }

  return sideMenu;
}
