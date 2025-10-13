import "./toolbar.css";

export function createToolbar() {
  const toolbar = document.createElement("nav");
  toolbar.className = "iconbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Editor toolbar");

  const mainContent = document.createElement("div");
  mainContent.className = "iconbar-main-content";
  toolbar.appendChild(mainContent);

  mainContent.innerHTML = `
    <button type="button" class="iconbtn text-btn" data-action="set-line-type" data-type="scene-heading" title="Scene Heading">SH</button>
    <button type="button" class="iconbtn text-btn" data-action="set-line-type" data-type="action" title="Action">Act</button>
    <button type="button" class="iconbtn text-btn" data-action="set-line-type" data-type="character" title="Character">Char</button>
    <button type="button" class="iconbtn text-btn" data-action="set-line-type" data-type="dialogue" title="Dialogue">Dial</button>
    <button type="button" class="iconbtn text-btn" data-action="set-line-type" data-type="parenthetical" title="Parenthetical">Par</button>
    <button type="button" class="iconbtn text-btn" data-action="set-line-type" data-type="transition" title="Transition">Trans</button>
    <button type="button" class="iconbtn text-btn" data-action="set-line-type" data-type="shot" title="Shot">Shot</button>

    <span class="sep" aria-hidden="true"></span>

    <button type="button" class="iconbtn text-btn" data-action="toggle-inline-style" data-style="bold" title="Bold">B</button>
    <button type="button" class="iconbtn text-btn" data-action="toggle-inline-style" data-style="italic" title="Italic">I</button>
    <button type="button" class="iconbtn text-btn" data-action="toggle-inline-style" data-style="underline" title="Underline">U</button>

    <span class="sep" aria-hidden="true"></span>

    <button type="button" class="iconbtn" data-action="undo" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 17a7 7 0 0 0-7-7H3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </button>

    <button type="button" class="iconbtn" data-action="redo" aria-label="Redo (Ctrl+Y)" title="Redo (Ctrl+Y)">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17 7l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 17a7 7 0 0 1 7-7h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </button>

    <span class="sep" aria-hidden="true"></span>

    <button type="button" class="iconbtn" data-action="search" aria-label="Search (Ctrl+F)" title="Search (Ctrl+F)">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M16 16l5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </button>
  `;

  // const moreButtonContainer = document.createElement("div");
  // moreButtonContainer.className = "iconbar-more-container";
  // toolbar.appendChild(moreButtonContainer);

  // const moreButton = document.createElement("button");
  // moreButton.type = "button";
  // moreButton.className = "iconbtn iconbar-more-button";
  // moreButton.setAttribute("aria-label", "More actions");
  // moreButton.setAttribute("title", "More actions");
  // moreButton.innerHTML = `
  //   <svg viewBox="0 0 24 24" aria-hidden="true">
  //     <circle cx="12" cy="12" r="1.5" />
  //     <circle cx="6" cy="12" r="1.5" />
  //     <circle cx="18" cy="12" r="1.5" />
  //   </svg>
  // `;
  // moreButtonContainer.appendChild(moreButton);

  // const dropdown = document.createElement("div");
  // dropdown.className = "iconbar-dropdown";
  // moreButtonContainer.appendChild(dropdown);

  // moreButton.addEventListener("click", (e) => {
  //   e.stopPropagation();
  //   dropdown.classList.toggle("visible");
  // });

  // document.addEventListener("click", (e) => {
  //   if (!moreButtonContainer.contains(e.target)) {
  //     dropdown.classList.remove("visible");
  //   }
  // });

  // const handleResize = () => {
  //   const availableWidth = toolbar.clientWidth;
  //   const moreButtonWidth = moreButtonContainer.offsetWidth;
  //   let requiredWidth = 0;

  //   // Make all items visible to measure them
  //   const children = Array.from(mainContent.children);
  //   children.forEach((child) => {
  //     child.style.display = "";
  //   });

  //   dropdown.innerHTML = "";
  //   let visibleItemsWidth = 0;
  //   let firstItemToHide = -1;

  //   for (let i = 0; i < children.length; i++) {
  //     const child = children[i];
  //     const childWidth = child.offsetWidth + 4; // 4 is the gap
  //     if (visibleItemsWidth + childWidth > availableWidth - moreButtonWidth) {
  //       firstItemToHide = i;
  //       break;
  //     }
  //     visibleItemsWidth += childWidth;
  //   }

  //   if (firstItemToHide !== -1) {
  //     moreButtonContainer.style.visibility = "visible";
  //     for (let i = 0; i < children.length; i++) {
  //       const child = children[i];
  //       if (i >= firstItemToHide) {
  //         child.style.display = "none";
  //         const clone = child.cloneNode(true);
  //         clone.style.display = "";
  //         dropdown.appendChild(clone);
  //       }
  //     }
  //   } else {
  //     moreButtonContainer.style.visibility = "hidden";
  //   }
  // };

  // const observer = new ResizeObserver(handleResize);
  // observer.observe(toolbar);

  // // Initial check
  // setTimeout(handleResize, 0);

  return toolbar;
}
