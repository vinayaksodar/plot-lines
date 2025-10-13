export function createWelcomeModal(onContinue) {
  const modal = document.createElement("div");
  modal.className = "welcome-modal"; // Using a specific class for styling
  modal.innerHTML = `
    <div class="welcome-modal-content">
      <h3>Welcome to Plot Lines!</h3>
      <p>A modern screenplay editor for the web.</p>
      <p>Here are some of the key features:</p>
      <ul>
        <li><strong>Hybrid Persistence:</strong> Work with local-only documents or cloud-based documents for collaboration.</li>
        <li><strong>Real-time Collaboration:</strong> Invite others to write with you in real-time on cloud documents.</li>
        <li><strong>Fountain Support:</strong> Import and export screenplays in the popular .fountain format.</li>
        <li><strong>Rich Text Editing:</strong> Full support for rich text formatting in your screenplay.</li>
        <li><strong>Undo/Redo:</strong> A robust undo/redo system to track your changes.</li>
      </ul>
      <div class="welcome-modal-actions">
        <button class="btn" data-action="continue">Continue</button>
      </div>
    </div>
  `;

  modal.addEventListener("click", (e) => {
    if (e.target.dataset.action === "continue") {
      document.body.removeChild(modal);
      onContinue();
    }
  });

  return modal;
}
