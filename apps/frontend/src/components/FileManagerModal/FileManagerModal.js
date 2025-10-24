import "./filemanagermodal.css";

export function createFileManagerModal(props) {
  const { files, user, callbacks, showCloseButton = true } = props;

  const modal = document.createElement("div");
  modal.className = "file-manager-modal";
  modal.innerHTML = `
    <div class="file-manager-content">
      <h3>Manage Files</h3>
      <p class="beta-version-note" style="font-size: 0.7em;">The product is still in beta there may be data loss backup your files. Local documents are saved in your browser history, clearing it will delete them. </p>
      ${!user ? '<p class="auth-prompt">Log in to create and view cloud documents. ☁️</p>' : ""}
      <div class="file-list"></div>
      <div class="file-manager-actions">
        <button class="btn" data-action="new-local">New Local Document</button>
        ${
          user
            ? '<button class="btn" data-action="new-cloud">New Cloud Document</button><button class="btn" data-action="logout">Logout</button>'
            : '<button class="btn" data-action="login">Login / Signup</button>'
        }
        ${showCloseButton ? '<button class="btn" data-action="close">Close</button>' : ""}
      </div>
    </div>
  `;

  const fileList = modal.querySelector(".file-list");
  if (files.length === 0) {
    fileList.innerHTML = "<p>No saved files</p>";
  } else {
    files.forEach((fileData) => {
      const fileItem = document.createElement("div");
      fileItem.className = "file-item";
      const isCloud = fileData.id && fileData.id.startsWith("cloud-");
      const fileName = isCloud ? fileData.name : fileData.fileName;
      const fileId = fileData.id;

      fileItem.innerHTML = `
        <span class="file-name">${fileName} ${isCloud ? "☁️" : ""}</span>
        <span class="file-date">${new Date(
          fileData.timestamp,
        ).toLocaleString()}</span>
        <button class="btn-small" data-action="load" data-filename="${fileId}">Load</button>
        <button class="btn-small btn-danger" data-action="delete" data-filename="${fileId}">Delete</button>
      `;
      fileList.appendChild(fileItem);
    });
  }

  modal.addEventListener("click", async (e) => {
    const action = e.target.dataset.action;
    const fileId = e.target.dataset.filename;
    let shouldClose = false;

    if (action === "close") {
      callbacks.onClose?.();
      shouldClose = true;
    } else if (action === "logout") {
      callbacks.onLogout?.();
      shouldClose = true;
    } else if (action === "login") {
      callbacks.onLogin?.();
      shouldClose = true;
    } else if (action === "new-local") {
      try {
        await callbacks.onNewLocal?.();
        shouldClose = true;
      } catch (error) {
        console.error("Error creating new local document:", error);
      }
    } else if (action === "new-cloud") {
      try {
        const result = await callbacks.onNewCloud?.();
        if (result) {
          shouldClose = true;
        }
      } catch (error) {
        console.error("Error creating new cloud document:", error);
      }
    } else if (action === "load") {
      try {
        await callbacks.onLoad?.(fileId);
        shouldClose = true; // Only close if load is successful
      } catch (error) {
        console.error("Error loading document:", error);
        // Optionally, display an error message in the modal
        // shouldClose remains false, so the modal stays open
      }
    } else if (action === "delete") {
      if (confirm(`Delete file?`)) {
        try {
          await callbacks.onDelete?.(fileId);
          // After deletion, the modal is re-rendered by the manager, so we just close this one.
          shouldClose = true;
        } catch (error) {
          console.error("Error deleting document:", error);
        }
      }
    }

    if (shouldClose) {
      document.body.removeChild(modal);
    }
  });

  return modal;
}
