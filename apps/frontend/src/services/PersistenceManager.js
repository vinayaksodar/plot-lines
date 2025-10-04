import { Persistence, CollabPlugin } from "@plot-lines/editor";
import { authService } from "./Auth.js";

export class PersistenceManager extends Persistence {
  constructor(editor, fileManager, backendManager, titlePage) {
    super(editor);
    this.fileManager = fileManager;
    this.backendManager = backendManager;
    this.titlePage = titlePage;
  }

  async new(name = "Untitled", isCloud = false) {
    this.editor.destroyPlugin("CollabPlugin");

    if (isCloud) {
      let user = authService.getCurrentUser();
      if (!user) {
        try {
          user = await authService.showLoginModal();
        } catch (e) {
          return false; // User cancelled login, do not proceed
        }
      }

      try {
        const result = await this.backendManager.new(name, user.id);
        this.editor.documentId = `cloud-${result.id}`;
      } catch (error) {
        console.error("Failed to create new cloud document:", error);
        alert(`Failed to create new cloud document: ${error.message}`);
        return false; // Do not proceed
      }

      this.editor.isCloudDocument = true;
      const userMap = new Map([[user.id, user.email]]);

      const collabPlugin = new CollabPlugin({
        serverUrl: "ws://localhost:3000",
        backendManager: this.backendManager,
        persistenceManager: this,
        userID: user.id,
        userMap,
      });
      this.editor.registerPlugin(collabPlugin);
      collabPlugin.connect();

      this.editor.getModel().setText("");
      this.editor.focusEditor();
      return true; // Success
    } else {
      this.editor.documentId = null;
      this.editor.isCloudDocument = false;
      this.editor.getModel().setText("");
      this.editor.focusEditor();
      return true; // Success
    }
  }

  async load(documentId) {
    this.editor.destroyPlugin("CollabPlugin");

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

      try {
        const doc = await this.backendManager.load(
          documentId.replace("cloud-", ""),
        );
        if (doc && doc.content) {
          const payload = JSON.parse(doc.content);
          if (payload.lines && payload.lines.length > 0) {
            this.editor.getModel().lines = payload.lines;
          } else {
            this.editor.getModel().setText("");
          }
          if (payload.titlePage) {
            this.titlePage.model.update(payload.titlePage);
            this.titlePage.render();
          }
          this.editor.getModel().ot_version = doc.snapshot_ot_version;
        } else {
          this.editor.getModel().setText("");
        }
      } catch (error) {
        console.error("Failed to load cloud document:", error);
        return; // Do not proceed
      }

      const collabPlugin = new CollabPlugin({
        serverUrl: "ws://localhost:3000",
        backendManager: this.backendManager,
        persistenceManager: this,
        userID: user.id,
        userMap: new Map(),
        ot_version: this.editor.getModel().ot_version,
      });
      this.editor.registerPlugin(collabPlugin);
      const stepsResult = await this.backendManager.getSteps(
        documentId.replace("cloud-", ""),
        this.editor.getModel().ot_version,
      );

      if (stepsResult.steps && stepsResult.steps.length > 0) {
        collabPlugin.receive(stepsResult.steps, stepsResult.userIDs, true);
      }

      collabPlugin.connect();

      this.editor.getView().render();
    } else {
      this.editor.isCloudDocument = false;
      this.fileManager.load(documentId);
    }
  }

  async save(options) {
    try {
      if (this.editor.isCloudDocument) {
        if (!this.editor.documentId) {
          // This case should ideally not be reached with the new workflow
          // but as a fallback, we can treat it as a first save.
          const name = prompt("Enter a name for your cloud document:");
          if (!name) return;
          await this.new(name, true);
          return;
        }
        // Save a snapshot for an existing cloud document
        const payload = {
          titlePage: this.titlePage.model.getData(),
          lines: this.editor.getModel().lines,
        };
        const content = JSON.stringify(payload);
        const ot_version = this.editor.collab
          ? this.editor.collab.getVersion()
          : 0;
        const documentId = this.editor.documentId.replace("cloud-", "");
        await this.backendManager.createSnapshot(
          documentId,
          content,
          ot_version,
        );
      } else {
        // This handles both new and existing local files
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
      try {
        const cloudFiles = await this.backendManager.list(user.id);
        return [
          ...localFiles,
          ...cloudFiles.map((f) => ({
            ...f,
            name: f.name,
            id: `cloud-${f.id}`,
          })),
        ];
      } catch (error) {
        console.error("Failed to list cloud files:", error);
        // Return only local files if cloud files fail to load
        return localFiles;
      }
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
    const user = authService.getCurrentUser();

    // Create a simple file manager modal
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
              ? '<button class="btn" data-action="new-cloud">New Cloud Document</button>'
              : '<button class="btn" data-action="login">Login / Signup</button>'
          }
          <button class="btn" data-action="close">Close</button>
        </div>
      </div>
    `;

    const fileList = modal.querySelector(".file-list");
    this.list().then((savedFiles) => {
      if (savedFiles.length === 0) {
        fileList.innerHTML = "<p>No saved files</p>";
      } else {
        savedFiles.forEach((fileData) => {
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
      } else if (action === "login") {
        try {
          await authService.showLoginModal();
          document.body.removeChild(modal);
          this.showFileManager(); // Refresh the modal
        } catch (e) {
          // User cancelled login, do nothing
        }
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
          try {
            if (fileName.startsWith("cloud-")) {
              await this.backendManager.delete(fileName.replace("cloud-", ""));
            } else {
              this.fileManager.deleteFromLocalStorage(fileName);
            }

            // If the deleted file is the currently open one, close the editor
            if (this.editor.documentId === fileName) {
              this.closeEditor();
            }
            document.body.removeChild(modal);
            this.showFileManager(); // Re-open to refresh the list
          } catch (error) {
            console.error("Failed to delete file:", error);
            this.showToast("Failed to delete file", "error");
          }
        }
      }
    });

    document.body.appendChild(modal);
  }

  closeEditor() {
    this.new();
  }

  showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 100); // Delay to allow for CSS transition

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 500); // Wait for fade out transition
    }, 3000); // Display for 3 seconds
  }
}
