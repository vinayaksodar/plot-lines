import { Persistence, FountainParser } from "@plot-lines/editor";

export class FileManager extends Persistence {
  constructor(model, view, titlePage) {
    super(null); // The editor instance will be injected by the Editor.
    this.model = model;
    this.view = view;
    this.titlePage = titlePage;
    this.fountainParser = new FountainParser();
    this.currentFileName = "untitled.txt";
    this.autoSaveInterval = null;
    this.autoSaveDelay = 2000; // 2 seconds
    this.lastSaveTime = Date.now();

    this.setupGlobalKeyboardShortcuts();

    // Start auto-save
    // this.startAutoSave();//Disable for now
  }

  // Setup global keyboard shortcuts for file operations
  setupGlobalKeyboardShortcuts() {
    this.onGlobalKeyDown = this.onGlobalKeyDown.bind(this);
    window.addEventListener("keydown", this.onGlobalKeyDown);
  }

  // Handle global keyboard shortcuts for file operations
  onGlobalKeyDown(e) {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // File operations
    if (isCtrlOrCmd && e.key === "n") {
      e.preventDefault();
      this.handleNewFile();
      return;
    }

    if (isCtrlOrCmd && e.key === "o") {
      e.preventDefault();
      this.handleOpenFile();
      return;
    }

    if (isCtrlOrCmd && e.key === "s") {
      e.preventDefault();
      this.handleSaveFile();
      return;
    }
  }

  // Clean up event listeners
  destroy() {
    this.stopAutoSave();
    if (this.onGlobalKeyDown) {
      window.removeEventListener("keydown", this.onGlobalKeyDown);
    }
  }

  // Auto-save functionality
  startAutoSave() {
    this.autoSaveInterval = setInterval(() => {
      this.autoSaveToLocalStorage();
    }, this.autoSaveDelay);
  }

  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  autoSaveToLocalStorage() {
    const content = JSON.stringify(this.model.lines);
    const titlePage = this.titlePage.model.getData();
    const saveData = {
      content,
      titlePage,
      fileName: this.currentFileName,
      timestamp: Date.now(),
      cursor: { ...this.model.cursor },
      selection: this.model.selection ? { ...this.model.selection } : null,
    };

    localStorage.setItem("editor-autosave", JSON.stringify(saveData));
    this.lastSaveTime = Date.now();
  }

  // Load from auto-save
  loadFromAutoSave() {
    try {
      const saved = localStorage.getItem("editor-autosave");
      if (saved) {
        const saveData = JSON.parse(saved);
        try {
          // Handle new rich-text format
          this.model.lines = JSON.parse(saveData.content);
        } catch (e) {
          console.error("Failed to parse content from auto-save", e);
          // Fallback for old plain-text format
          this.model.setText(saveData.content);
        }
        this.currentFileName = saveData.fileName || "untitled.txt";

        if (saveData.titlePage) {
          this.titlePage.model.update(saveData.titlePage);
          this.titlePage.render();
        }

        // Restore cursor and selection
        if (saveData.cursor) {
          this.model.updateCursor(saveData.cursor);
        }
        if (saveData.selection) {
          this.model.setSelection(
            saveData.selection.start,
            saveData.selection.end,
          );
        }

        return true;
      }
    } catch (error) {
      console.error("Failed to load auto-save:", error);
    }
    return false;
  }

  // Manual save to localStorage with custom name
  saveToLocalStorage() {
    const content = JSON.stringify(this.model.lines);
    const titlePage = this.titlePage.model.getData();
    const saveData = {
      titlePage,
      content,
      fileName: this.currentFileName,
      timestamp: Date.now(),
      cursor: { ...this.model.cursor },
      selection: this.model.selection ? { ...this.model.selection } : null,
    };

    // Save to named slot
    const savedFiles = this.getSavedFiles();
    savedFiles[this.currentFileName] = saveData;
    localStorage.setItem("editor-saved-files", JSON.stringify(savedFiles));

    return this.currentFileName;
  }

  // Get all saved files from localStorage
  getSavedFiles() {
    try {
      const saved = localStorage.getItem("editor-saved-files");
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error("Failed to get saved files:", error);
      return {};
    }
  }

  // Load specific file from localStorage
  loadFromLocalStorage(fileName) {
    try {
      const savedFiles = this.getSavedFiles();
      const fileData = savedFiles[fileName];

      if (fileData) {
        try {
          // Handle new rich-text format
          this.model.lines = JSON.parse(fileData.content);
        } catch (e) {
          console.error("Failed to parse content from saved file", e);
          // Fallback for old plain-text format
          this.model.setText(fileData.content);
        }
        if (fileData.titlePage) {
          this.titlePage.model.update(fileData.titlePage);
          this.titlePage.render();
        }

        // Restore cursor and selection
        if (fileData.cursor) {
          this.model.updateCursor(fileData.cursor);
        }
        if (fileData.selection) {
          this.model.setSelection(
            fileData.selection.start,
            fileData.selection.end,
          );
        }

        return true;
      }
    } catch (error) {
      console.error("Failed to load file:", error);
    }
    return false;
  }

  // Delete file from localStorage
  deleteFromLocalStorage(fileName) {
    try {
      const savedFiles = this.getSavedFiles();
      delete savedFiles[fileName];
      localStorage.setItem("editor-saved-files", JSON.stringify(savedFiles));
      return true;
    } catch (error) {
      console.error("Failed to delete file:", error);
      return false;
    }
  }

  // Export file (download)

  exportFile(fileName = null, content = null) {
    const finalFileName = fileName || this.currentFileName;
    const finalContent = content || this.model.getText();

    const blob = new Blob([finalContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = finalFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  importFountainFile() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".fountain";

      input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) {
          reject(new Error("No file selected"));
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result;
          const { titlePage, lines } = this.fountainParser.parse(content);
          this.model.lines = lines;
          this.titlePage.model.update(titlePage);
          this.titlePage.render();
          this.currentFileName = file.name;

          // Reset cursor to beginning
          this.model.updateCursor({ line: 0, ch: 0 });
          this.model.clearSelection();

          resolve({
            fileName: file.name,
            content: content,
            size: file.size,
          });
        };

        reader.onerror = () => {
          reject(new Error("Failed to read file"));
        };

        reader.readAsText(file);
      };

      input.click();
    });
  }

  exportFountainFile() {
    const data = {
      titlePage: this.titlePage.model.getData(),
      lines: this.model.lines,
    };
    const fountainText = this.fountainParser.export(data);
    const fileName = this.currentFileName.replace(/\.txt$/, ".fountain");
    this.exportFile(fileName, fountainText);
  }

  // Import file (upload)
  importFile() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept =
        ".txt,.js,.ts,.jsx,.tsx,.css,.html,.md,.json,.xml,.csv,.log";

      input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) {
          reject(new Error("No file selected"));
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result;
          this.model.setText(content);
          this.currentFileName = file.name;

          // Reset cursor to beginning
          this.model.updateCursor({ line: 0, ch: 0 });
          this.model.clearSelection();

          resolve({
            fileName: file.name,
            content: content,
            size: file.size,
          });
        };

        reader.onerror = () => {
          reject(new Error("Failed to read file"));
        };

        reader.readAsText(file);
      };

      input.click();
    });
  }

  // Create new file
  newFile() {
    this.model.setText("");
    this.currentFileName = null; // A new file is untitled
    this.model.updateCursor({ line: 0, ch: 0 });
    this.model.clearSelection();
  }

  // ... (rest of the file)

  async save(options) {
    let fileName = (options && options.fileName) || this.currentFileName;
    if (!fileName) {
      fileName = prompt("Enter filename:", "untitled.txt");
      if (!fileName) return; // User cancelled
    }
    this.saveToLocalStorage(fileName);
    console.log(`Saved as: ${fileName}`);
  }

  // Get current file info
  getCurrentFileInfo() {
    return {
      fileName: this.currentFileName,
      content: this.model.getText(),
      size: this.model.getText().length,
      lines: this.model.lines.length,
      lastSaved: this.lastSaveTime,
    };
  }

  // Check if file has unsaved changes
  hasUnsavedChanges() {
    const saved = localStorage.getItem("editor-autosave");
    const currentContent = JSON.stringify(this.model.lines);

    if (!saved) {
      // If there's no autosave, there are "unsaved changes" only if
      // the user has typed something into the initial blank document.
      const initialContent = JSON.stringify([
        {
          type: "action",
          segments: [
            { text: "", bold: false, italic: false, underline: false },
          ],
        },
      ]);
      return currentContent !== initialContent;
    }

    try {
      const saveData = JSON.parse(saved);
      return saveData.content !== currentContent;
    } catch (error) {
      console.error("Failed to parse auto-save data", error);
      return true;
    }
  }

  // Handler methods for UI interactions
  handleNewFile() {
    if (this.hasUnsavedChanges()) {
      if (!confirm("You have unsaved changes. Create new file anyway?")) {
        return;
      }
    }
    this.newFile();
    this.editor.focusEditor();
  }

  async handleOpenFile() {
    if (this.hasUnsavedChanges()) {
      if (!confirm("You have unsaved changes. Open new file anyway?")) {
        return;
      }
    }
    try {
      const result = await this.importFile();
      this.editor.focusEditor();
      if (this.view) {
        this.view.render();
      }
      console.log(`Opened file: ${result.fileName} (${result.size} bytes)`);
    } catch (error) {
      if (error.message !== "No file selected") {
        console.error("Open file failed:", error);
        alert("Failed to open file: " + error.message);
      }
      this.editor.focusEditor();
    }
  }

  handleSaveFile() {
    const fileName = prompt("Enter filename:", this.currentFileName);
    if (fileName) {
      this.saveToLocalStorage(fileName);
      console.log(`Saved as: ${fileName}`);
    }
    this.editor.focusEditor();
  }

  handleExportFile() {
    this.exportFile();
    this.editor.focusEditor();
  }

  async handleImportFountain() {
    if (this.hasUnsavedChanges()) {
      if (!confirm("You have unsaved changes. Import new file anyway?")) {
        return;
      }
    }
    try {
      const result = await this.importFountainFile();
      this.editor.focusEditor();
      if (this.view) {
        this.view.render();
      }
      console.log(`Opened file: ${result.fileName} (${result.size} bytes)`);
    } catch (error) {
      if (error.message !== "No file selected") {
        console.error("Open file failed:", error);
        alert("Failed to open file: " + error.message);
      }
      this.editor.focusEditor();
    }
  }

  handleExportFountain() {
    this.exportFountainFile();
    this.editor.focusEditor();
  }

  handleManageFiles() {
    // This is now handled by the PersistenceManager
  }

  // --- Persistence Interface Implementation ---

  async new() {
    this.handleNewFile();
  }

  async load(documentId) {
    return this.loadFromLocalStorage(documentId);
  }

  async import(format) {
    if (format === "fountain") {
      return this.handleImportFountain();
    }
    return this.handleOpenFile();
  }

  async export(format) {
    if (format === "fountain") {
      return this.handleExportFountain();
    }
    this.exportFile();
  }

  async list() {
    return Object.values(this.getSavedFiles());
  }

  async manage() {
    this.handleManageFiles();
  }
}
