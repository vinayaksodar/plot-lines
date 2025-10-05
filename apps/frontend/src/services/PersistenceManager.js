import { Persistence, CollabPlugin, FountainParser } from "@plot-lines/editor";
import { authService } from "./Auth.js";
import { LocalPersistence } from "./LocalPersistence.js";
import { CloudPersistence } from "./CloudPersistence.js";

export class PersistenceManager extends Persistence {
  constructor(editor, titlePage) {
    super(editor);
    this.titlePage = titlePage;
    this.documentName = "Untitled";
  }

  initialize(editor) {
    this.editor = editor;
    this.localPersistence = new LocalPersistence(
      editor.model,
      editor.view,
      this.titlePage,
    );
    this.cloudPersistence = new CloudPersistence(editor);
  }

  get activePersistence() {
    return this.editor.isCloudDocument
      ? this.cloudPersistence
      : this.localPersistence;
  }

  async new(name = "Untitled", isCloud = false) {
    this.documentName = name;
    this.editor.destroyPlugin("CollabPlugin");

    if (isCloud) {
      let user = authService.getCurrentUser();
      if (!user) {
        try {
          user = await authService.showLoginModal();
        } catch (e) {
          console.error("Login failed", e);
          return false;
        }
      }

      try {
        const result = await this.cloudPersistence.new(name, user.id);
        this.editor.documentId = `cloud-${result.id}`;
      } catch (error) {
        console.error("Failed to create new cloud document:", error);
        alert(`Failed to create new cloud document: ${error.message}`);
        return false;
      }

      this.editor.isCloudDocument = true;
      const userMap = new Map([[user.id, user.email]]);

      const collabPlugin = new CollabPlugin({
        serverUrl: "ws://localhost:3000",
        backendManager: this.cloudPersistence,
        persistenceManager: this,
        userID: user.id,
        userMap,
      });
      this.editor.registerPlugin(collabPlugin);
      collabPlugin.connect();

      this.editor.getModel().setText("");
      this.editor.focusEditor();
      return true;
    } else {
      const newId = `local-${Date.now()}`;
      this.editor.documentId = newId;
      this.documentName = name;
      this.editor.isCloudDocument = false;
      this.editor.getModel().setText("");
      this.editor.focusEditor();
      await this.localPersistence.save({
        documentId: newId,
        fileName: name,
        content: "[]",
      });
      return true;
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
          console.error("Login failed", e);
          return;
        }
      }

      this.editor.documentId = documentId;
      this.editor.isCloudDocument = true;

      try {
        const doc = await this.cloudPersistence.load(
          documentId.replace("cloud-", ""),
        );
        this.documentName = doc.name;
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
        return;
      }

      const collabPlugin = new CollabPlugin({
        serverUrl: "ws://localhost:3000",
        backendManager: this.cloudPersistence,
        persistenceManager: this,
        userID: user.id,
        userMap: new Map(),
        ot_version: this.editor.getModel().ot_version,
      });
      this.editor.registerPlugin(collabPlugin);
      const stepsResult = await this.cloudPersistence.getSteps(
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
      this.editor.getModel().setText("");
      const fileData = await this.localPersistence.load(documentId);
      if (fileData) {
        this.documentName = fileData.fileName;
        this.editor.documentId = documentId;
      }
    }
  }

  async save() {
    try {
      if (this.editor.isCloudDocument) {
        const payload = {
          titlePage: this.titlePage.model.getData(),
          lines: this.editor.getModel().lines,
        };
        const content = JSON.stringify(payload);
        const ot_version = this.editor.collab
          ? this.editor.collab.getVersion()
          : 0;
        const documentId = this.editor.documentId.replace("cloud-", "");
        await this.cloudPersistence.createSnapshot(
          documentId,
          content,
          ot_version,
        );
      } else {
        await this.localPersistence.save({
          documentId: this.editor.documentId,
          fileName: this.documentName,
          content: JSON.stringify(this.editor.getModel().lines),
        });
      }
      this.showToast("Saved successfully");
    } catch (e) {
      console.error("Save failed:", e);
      this.showToast("Save failed", "error");
    }
  }

  async rename() {
    const oldId = this.editor.documentId;
    if (!oldId) {
      this.showToast("Cannot rename an unsaved document", "error");
      return;
    }

    const currentName = this.documentName;
    const newName = prompt("Enter a new name for your document:", currentName);

    if (newName && newName !== currentName) {
      try {
        if (this.editor.isCloudDocument) {
          const cloudId = oldId.replace("cloud-", "");
          await this.cloudPersistence.rename(cloudId, newName);
        } else {
          await this.localPersistence.rename(oldId, newName);
        }
        this.documentName = newName;
        this.showToast("Renamed successfully");
      } catch (e) {
        console.error("Rename failed:", e);
        this.showToast("Rename failed", "error");
      }
    }
  }

  async export(format) {
    if (format === "fountain") {
      const parser = new FountainParser();
      const fountainText = parser.export({
        titlePage: this.titlePage.model.getData(),
        lines: this.editor.getModel().lines,
      });
      const blob = new Blob([fountainText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${this.documentName}.fountain`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      throw new Error(`Export for format ${format} is not supported.`);
    }
  }

  async import(format) {
    if (format === "fountain") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".fountain";
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          const parser = new FountainParser();
          const { titlePage, lines } = parser.parse(text);
          this.titlePage.model.update(titlePage);
          this.titlePage.render();
          this.editor.getModel().lines = lines;
          this.editor.getView().render();
        };
        reader.readAsText(file);
      };
      input.click();
    } else {
      throw new Error(`Import for format ${format} is not supported.`);
    }
  }

  async list() {
    const localFiles = await this.localPersistence.list();
    const user = authService.getCurrentUser();
    if (user) {
      try {
        const cloudFiles = await this.cloudPersistence.list(user.id);
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
        return localFiles;
      }
    }
    return localFiles;
  }

  async manage() {
    this.showFileManager();
  }

  showFileManager(showCloseButton = true) {
    const user = authService.getCurrentUser();

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
          ${showCloseButton ? '<button class="btn" data-action="close">Close</button>' : ""}
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
    });

    modal.addEventListener("click", async (e) => {
      const action = e.target.dataset.action;
      const fileId = e.target.dataset.filename;
      let shouldClose = false;

      if (action === "close") {
        shouldClose = true;
        this.editor.focusEditor();
      } else if (action === "login") {
        try {
          await authService.showLoginModal();
          shouldClose = true;
          this.showFileManager();
        } catch (e) {
          console.error("Login failed", e);
        }
      } else if (action === "new-local") {
        await this.new(undefined, false);
        shouldClose = true;
      } else if (action === "new-cloud") {
        const result = await this.new(undefined, true);
        if (result) {
          shouldClose = true;
        }
      } else if (action === "load") {
        await this.load(fileId);
        if (this.editor.view) {
          this.editor.view.render();
        }
        this.editor.focusEditor();
        shouldClose = true;
      } else if (action === "delete") {
        if (confirm(`Delete file?`)) {
          try {
            if (fileId.startsWith("cloud-")) {
              await this.cloudPersistence.delete(fileId.replace("cloud-", ""));
            } else {
              await this.localPersistence.delete(fileId);
            }

            if (this.editor.documentId === fileId) {
              this.closeEditor();
            }
            shouldClose = true;
            this.showFileManager(this.editor.documentId !== null);
          } catch (error) {
            console.error("Failed to delete file:", error);
            this.showToast("Failed to delete file", "error");
          }
        }
      }

      if (shouldClose) {
        document.body.removeChild(modal);
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
    }, 100);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 500);
    }, 3000);
  }
}
