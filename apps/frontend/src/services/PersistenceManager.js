import { Persistence, CollabPlugin } from "@plot-lines/editor";
import { FountainParser } from "./FountainParser.js";
import { authService } from "./Auth.js";
import { LocalPersistence } from "./LocalPersistence.js";
import { CloudPersistence } from "./CloudPersistence.js";
import { CollabService } from "./CollabService.js";

export class PersistenceManager extends Persistence {
  constructor(getTitlePageData) {
    super(null);
    this.getTitlePageData = getTitlePageData;

    this.documentName = "Untitled";
    this.documentId = null;
    this.isCloudDocument = false;
    this.collabService = null;

    this.localPersistence = new LocalPersistence();
    this.cloudPersistence = new CloudPersistence();
    this._events = {};

    this.getCollabPlugin = null;
    this.getCursorPos = null;
  }

  setEditorAccessors({ getCollabPlugin, getCursorPos }) {
    this.getCollabPlugin = getCollabPlugin;
    this.getCursorPos = getCursorPos;
  }

  on(event, callback) {
    if (!this._events[event]) {
      this._events[event] = [];
    }
    this._events[event].push(callback);
  }

  emit(event, data) {
    if (this._events[event]) {
      this._events[event].forEach(callback => callback(data));
    }
  }

  get activePersistence() {
    return this.isCloudDocument
      ? this.cloudPersistence
      : this.localPersistence;
  }

  async handleSaveRequest(data) {
    try {
      const content = JSON.stringify(data.lines);
      const titlePage = this.getTitlePageData();

      if (this.isCloudDocument) {
        const ot_version = this.getCollabPlugin()?.getVersion() || 0;
        const documentId = this.documentId.replace("cloud-", "");
        await this.cloudPersistence.createSnapshot(
          documentId,
          JSON.stringify({ lines: data.lines, titlePage }),
          ot_version,
        );
      } else {
        await this.localPersistence.save({
          documentId: this.documentId,
          fileName: this.documentName,
          content,
          titlePage,
        });
      }
      this.showToast("Saved successfully");
    } catch (e) {
      console.error("Save failed:", e);
      this.showToast("Save failed", "error");
    }
  }

  async new(name = "Untitled", isCloud = false) {
    this.documentName = name;
    this.emit("beforeNewDocument");
    this.destroyCollabService();

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
        this.documentId = `cloud-${result.id}`;
      } catch (error) {
        console.error("Failed to create new cloud document:", error);
        alert(`Failed to create new cloud document: ${error.message}`);
        return false;
      }

      this.isCloudDocument = true;
      this.emit("documentCreated", { isCloud: true, user });
      this.setupCollabService();
      return true;
    } else {
      this.documentId = `local-${Date.now()}`;
      this.documentName = name;
      this.isCloudDocument = false;
      this.emit("documentCreated", { isCloud: false });
      await this.localPersistence.save({
        documentId: this.documentId,
        fileName: this.documentName,
        content: "[]",
        titlePage: this.getTitlePageData(),
      });
      return true;
    }
  }

  async load(documentId) {
    this.emit("beforeLoad");
    this.destroyCollabService();

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

      this.documentId = documentId;
      this.isCloudDocument = true;

      try {
        const { doc, steps, userIDs } = await this.cloudPersistence.loadWithSteps(
          documentId.replace("cloud-", ""),
        );

        this.documentName = doc.name;
        const payload = doc.content ? JSON.parse(doc.content) : {};

        // Emit document loaded with initial snapshot content
        this.emit("documentLoaded", { ...payload, ot_version: doc.snapshot_ot_version, isCloud: true, user });

        // Get the collab plugin instance (it's created after documentLoaded)
        const collabPlugin = this.getCollabPlugin();

        // Apply the steps that happened after the snapshot
        if (collabPlugin && steps && steps.length > 0) {
          collabPlugin.receive({ steps, userIDs }, false); // Pass false on initial load
        }

        // Now connect to the websocket, fully in sync
        this.setupCollabService();
      } catch (error) {
        console.error("Failed to load cloud document:", error);
      }
    } else {
      this.isCloudDocument = false;
      const fileData = await this.localPersistence.load(documentId);
      if (fileData) {
        this.documentName = fileData.fileName;
        this.documentId = documentId;
        const content = fileData.content ? JSON.parse(fileData.content) : {};
        this.emit("documentLoaded", { lines: content, titlePage: fileData.titlePage, isCloud: false });
      }
    }
  }

  setupCollabService() {
    const collabPlugin = this.getCollabPlugin();
    console.log("[PersistenceManager] getCollabPlugin() returned:", collabPlugin);
    if (!collabPlugin) return;

    this.collabService = new CollabService({
      serverUrl: "ws://localhost:3000",
      backendManager: this.cloudPersistence,
      persistenceManager: this,
      documentId: this.documentId,
      onReceive: (message) => {
        collabPlugin.receive(message);
      },
      getOtVersion: () => collabPlugin.getVersion(),
      getSendableCommands: () => collabPlugin.sendableCommands(),
      getCursorPos: () => this.getCursorPos(),
      getUserID: () => collabPlugin.userID,
    });
    this.collabService.connect();
  }

  destroyCollabService() {
    if (this.collabService) {
      this.collabService.destroy();
      this.collabService = null;
    }
  }

  async rename() {
    const oldId = this.documentId;
    if (!oldId) {
      this.showToast("Cannot rename an unsaved document", "error");
      return;
    }

    const currentName = this.documentName;
    const newName = prompt("Enter a new name for your document:", currentName);

    if (newName && newName !== currentName) {
      try {
        if (this.isCloudDocument) {
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

  async export(format, data) {
    if (format === "fountain") {
      const parser = new FountainParser();
      const fountainText = parser.export(data);
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
          this.emit("documentLoaded", { lines, titlePage, isCloud: false });
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
        this.emit("focusEditor");
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
        shouldClose = true;
      } else if (action === "delete") {
        if (confirm(`Delete file?`)) {
          try {
            if (fileId.startsWith("cloud-")) {
              await this.cloudPersistence.delete(fileId.replace("cloud-", ""));
            } else {
              await this.localPersistence.delete(fileId);
            }

            if (this.documentId === fileId) {
              this.closeEditor();
            }
            shouldClose = true;
            this.showFileManager(this.documentId !== null);
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
