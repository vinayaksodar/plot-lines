import { CollabPlugin } from "@plot-lines/editor";
import { FountainParser } from "./FountainParser.js";
import { authService } from "./Auth.js";
import { LocalPersistence } from "./LocalPersistence.js";
import { CloudPersistence } from "./CloudPersistence.js";
import { CollabService } from "./CollabService.js";
import { createFileManagerModal } from "../components/FileManagerModal/FileManagerModal.js";

// Debounce utility function
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

export class PersistenceManager {
  constructor(getTitlePageData) {
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

    // Debounce the actual saveTitlePage logic
    this.debouncedSaveTitlePage = debounce(
      this._saveTitlePageInternal.bind(this),
      1000,
    );
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
      this._events[event].forEach((callback) => callback(data));
    }
  }

  get activePersistence() {
    return this.isCloudDocument ? this.cloudPersistence : this.localPersistence;
  }

  async handleSaveRequest(data) {
    try {
      // For cloud documents, saving is handled by auto-snapshot and separate title page save.
      // This method now only handles local document saves.
      if (!this.isCloudDocument) {
        const content = JSON.stringify(data.lines);
        await this.localPersistence.save({
          documentId: this.documentId,
          fileName: this.documentName,
          content,
          titlePage: data.titlePage,
        });
        this.showToast("Saved successfully");
      } else {
        this.showToast("Cloud documents are auto-saved.", "info");
      }
    } catch (e) {
      console.error("Save failed:", e);
      this.showToast("Save failed", "error");
    }
  }

  async triggerAutoSnapshot(lines, ot_version) {
    if (this.isCloudDocument) {
      const documentId = this.documentId.replace("cloud-", "");
      const content = JSON.stringify({
        lines: lines,
      });
      try {
        await this.cloudPersistence.createSnapshot(
          documentId,
          content,
          ot_version,
        );
      } catch (e) {
        console.error("Auto-snapshot failed:", e);
        this.showToast("Auto-snapshot failed", "error");
      }
    }
  }

  async _saveTitlePageInternal(titlePageContent) {
    // Renamed
    if (this.isCloudDocument) {
      const documentId = this.documentId.replace("cloud-", "");
      try {
        await this.cloudPersistence.updateTitlePage(
          documentId,
          titlePageContent,
        );
        // this.showToast("Title page saved");
      } catch (e) {
        console.error("Title page save failed:", e);
        this.showToast("Title page save failed", "error");
      }
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
          user = await authService.reauthenticate();
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
          user = await authService.reauthenticate();
        } catch (e) {
          console.error("Login failed", e);
          return;
        }
      }

      this.documentId = documentId;
      this.isCloudDocument = true;

      try {
        const { doc, steps, userIDs } =
          await this.cloudPersistence.loadWithSteps(
            documentId.replace("cloud-", ""),
          );

        this.documentName = doc.name;
        const payload = doc.content ? JSON.parse(doc.content) : {};

        // Emit document loaded with initial snapshot content
        this.emit("documentLoaded", {
          ...payload,
          titlePage: doc.titlePage, // Include the titlePage
          ot_version: doc.snapshot_ot_version,
          isCloud: true,
          user,
        });

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
        this.emit("documentLoaded", {
          lines: content,
          titlePage: fileData.titlePage,
          isCloud: false,
        });
      }
    }
  }

  setupCollabService() {
    const collabPlugin = this.getCollabPlugin();
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
      getUserName: () => authService.getCurrentUser()?.email,
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

  async delete(fileId) {
    try {
      if (fileId.startsWith("cloud-")) {
        await this.cloudPersistence.delete(fileId.replace("cloud-", ""));
      } else {
        await this.localPersistence.delete(fileId);
      }

      if (this.documentId === fileId) {
        this.closeEditor();
      }
      this.manage();
    } catch (error) {
      console.error("Failed to delete file:", error);
      this.showToast("Failed to delete file", "error");
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
    const files = await this.list();
    const user = authService.getCurrentUser();
    const showCloseButton = this.documentId !== null;

    const props = {
      files,
      user,
      showCloseButton,
      callbacks: {
        onLoad: (id) => this.load(id),
        onDelete: (id) => this.delete(id),
        onNewLocal: () => this.new(undefined, false),
        onNewCloud: () => this.new(undefined, true),
        onLogin: async () => {
          try {
            await authService.reauthenticate();
            this.manage();
          } catch (e) {
            console.log("Login was cancelled.");
            this.manage();
          }
        },
        onLogout: () => {
          authService.logout();
          this.manage();
        },
        onClose: () => this.emit("focusEditor"),
      },
    };

    const modal = createFileManagerModal(props);
    document.body.appendChild(modal);
  }

  closeEditor() {
    this.documentName = "Untitled";
    this.documentId = null;
    this.isCloudDocument = false;
    this.destroyCollabService();
    this.emit("documentClosed");
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
