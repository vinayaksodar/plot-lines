// src/components/SearchWidget/SearchWidget.js

import "./searchwidget.css";

export function createSearchWidget() {
  const wrapper = document.createElement("div");
  wrapper.className = "search-widget hidden"; // hidden by default

  wrapper.innerHTML = `
    <input 
      type="text" 
      placeholder="Search..." 
      class="search-input" 
    />
    <button class="search-btn" data-action="next">Next</button>
    <button class="search-btn" data-action="prev">Prev</button>
    <button class="search-btn" data-action="close">✕</button>
  `;

  return wrapper;
}
