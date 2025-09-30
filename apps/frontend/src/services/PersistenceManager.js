import { Persistence } from "@plot-lines/editor";
import { authService } from "./Auth.js";

export class PersistenceManager extends Persistence {
  constructor(editor, fileManager, backendManager) {
    super(editor);
    this.fileManager = fileManager;
    this.backendManager = backendManager;
  }

  async new(name, isCloud = false) {
    this.editor.documentId = null; // It's a new document
    this.editor.isCloudDocument = isCloud;
    this.editor.getModel().setText("");
    this.editor.focusEditor();

    if (isCloud) {
      let user = authService.getCurrentUser();
      if (!user) {
        try {
          user = await authService.showLoginModal();
        } catch (e) {
          // User cancelled login, revert to a local doc
          this.editor.isCloudDocument = false;
          return; // Return undefined on cancel
        }
      }
    }
    return true; // Return true on success
  }

  async load(documentId) {
    if (documentId.startsWith("cloud-")) {
      let user = authService.getCurrentUser();
      if (!user) {
        try {
          user = await authService.showLoginModal();
        } catch (e) {
          return; // User cancelled login
        }
      }
      this.editor.documentId = documentId;
      this.editor.isCloudDocument = true;
      const { data: doc } = await this.backendManager.load(
        documentId.replace("cloud-", ""),
      );
      if (doc && doc.content) {
        this.editor.getModel().lines = JSON.parse(doc.content);
        this.editor.getModel().version = doc.ot_version;
      }
      this.editor.getView().render();
    } else {
      this.editor.isCloudDocument = false;
      this.fileManager.load(documentId);
    }
  }

  async save(options) {
    const isNew = !this.editor.documentId;

    try {
        if (this.editor.isCloudDocument) {
            if (isNew) {
                const name = prompt("Enter a name for your cloud document:");
                if (!name) return;

                let user = authService.getCurrentUser();
                if (!user) {
                    try {
                        user = await authService.showLoginModal();
                    } catch (e) {
                        return; // User cancelled login
                    }
                }

                const result = await this.backendManager.new(name, user.id);
                if (result.error) {
                    alert(result.error);
                    return this.fileManager.new();
                }
                this.editor.documentId = `cloud-${result.id}`;
            }
            // Now save the snapshot
            const content = JSON.stringify(this.editor.getModel().lines);
            const ot_version = this.editor.collab.getVersion();
            const documentId = this.editor.documentId.replace("cloud-", "");
            await this.backendManager.createSnapshot(documentId, content, ot_version);

        } else {
          this.fileManager.save(options);
        }
        this.showToast("Saved successfully");
    } catch (e) {
        console.error("Save failed:", e);
        this.showToast("Save failed", "error");
    }
  }

  async list() {
    const localFiles = await this.fileManager.list();
    const user = authService.getCurrentUser();
    if (user) {
      const cloudFiles = await this.backendManager.list(user.id);
      return [
        ...localFiles,
        ...cloudFiles.map((f) => ({ ...f, name: f.name, id: `cloud-${f.id}` })),
      ];
    }
    return localFiles;
  }

  async import(format) {
    return this.fileManager.import(format);
  }

  async export(format) {
    return this.fileManager.export(format);
  }

  async manage() {
    this.showFileManager();
  }

  showFileManager() {
    // Create a simple file manager modal
    const modal = document.createElement("div");
    modal.className = "file-manager-modal";
    modal.innerHTML = `
      <div class="file-manager-content">
        <h3>Manage Files</h3>
        <div class="file-list"></div>
        <div class="file-manager-actions">
          <button class="btn" data-action="new-local">New Local Document</button>
          <button class="btn" data-action="new-cloud">New Cloud Document</button>
          <button class="btn" data-action="close">Close</button>
        </div>
      </div>
    `;

    const fileList = modal.querySelector(".file-list");
    this.list().then((savedFiles) => {
      if (Object.keys(savedFiles).length === 0) {
        fileList.innerHTML = "<p>No saved files</p>";
      } else {
        Object.values(savedFiles).forEach((fileData) => {
          const fileItem = document.createElement("div");
          fileItem.className = "file-item";
          const isCloud = fileData.id && fileData.id.startsWith("cloud-");
          const fileName = isCloud ? fileData.name : fileData.fileName;
          const fileId = isCloud ? fileData.id : fileName;

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
    });

    modal.addEventListener("click", async (e) => {
      const action = e.target.dataset.action;
      const fileName = e.target.dataset.filename;

      if (action === "close") {
        document.body.removeChild(modal);
        this.editor.focusEditor();
      } else if (action === "new-local") {
        await this.new(undefined, false);
        document.body.removeChild(modal);
      } else if (action === "new-cloud") {
        const result = await this.new(undefined, true);
        if (result) {
          // Only close modal on success
          document.body.removeChild(modal);
        }
      } else if (action === "load") {
        await this.load(fileName);
        if (this.editor.view) {
          this.editor.view.render();
        }
        this.editor.focusEditor();
        document.body.removeChild(modal);
      } else if (action === "delete") {
        if (confirm(`Delete file "${fileName}"?`)) {
          if (fileName.startsWith("cloud-")) {
            await this.backendManager.delete(fileName.replace("cloud-", ""));
          } else {
            this.fileManager.deleteFromLocalStorage(fileName);
          }
          document.body.removeChild(modal);
          this.showFileManager(); // Refresh the modal
        }
      }
    });

    document.body.appendChild(modal);
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100); // Delay to allow for CSS transition

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 500); // Wait for fade out transition
    }, 3000); // Display for 3 seconds
  }
}
