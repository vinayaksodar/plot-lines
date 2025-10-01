import { Statistics } from "@plot-lines/editor";
import "./statisticsview.css";

export function createStatisticsView(editor) {
  const statsView = document.createElement("div");
  statsView.className = "statistics-view";
  statsView.style.display = "none"; // Initially hidden

  let content = document.createElement("div");
  content.className = "statistics-content";
  statsView.appendChild(content);

  function formatStats(stats) {
    const characterStats = Object.entries(stats.characterDialogueCount)
      .map(([char, count]) => `<li><b>${char}:</b> ${count} lines</li>`)
      .join("");

    return `
      <h2>Statistics</h2>
      <ul>
        <li><b>Page Count:</b> ${stats.pageCount}</li>
        <li><b>Word Count:</b> ${stats.wordCount}</li>
        <li><b>Scene Count:</b> ${stats.sceneCount}</li>
        <li><b>Total Lines:</b> ${stats.totalLines}</li>
      </ul>
      <h3>Line Types</h3>
      <ul>
        <li><b>Action Lines:</b> ${stats.actionLineCount}</li>
        <li><b>Dialogue Lines:</b> ${stats.dialogueLineCount}</li>
        <li><b>Character Lines:</b> ${stats.characterLineCount}</li>
      </ul>
      <h3>Character Dialogue</h3>
      <ul class="character-stats">${characterStats}</ul>
    `;
  }

  function update() {
    const stats = new Statistics(editor.model);
    const allStats = stats.getAllStats();
    content.innerHTML = formatStats(allStats);
  }

  function show() {
    update();
    statsView.style.display = "block";
  }

  function hide() {
    statsView.style.display = "none";
  }

  return {
    element: statsView,
    show,
    hide,
    update,
  };
}
