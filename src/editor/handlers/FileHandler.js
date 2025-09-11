export class FileManager {
  constructor(model, view, hiddenInput) {
    this.model = model;
    this.view = view;
    this.hiddenInput = hiddenInput;
    this.currentFileName = "untitled.txt";
    this.autoSaveInterval = null;
    this.autoSaveDelay = 2000; // 2 seconds
    this.lastSaveTime = Date.now();

    // Start auto-save
    this.startAutoSave();
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
    const content = this.model.getText();
    const saveData = {
      content,
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
        this.model.setText(saveData.content);
        this.currentFileName = saveData.fileName || "untitled.txt";

        // Restore cursor and selection
        if (saveData.cursor) {
          this.model.updateCursor(saveData.cursor);
        }
        if (saveData.selection) {
          this.model.setSelection(
            saveData.selection.start,
            saveData.selection.end
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
  saveToLocalStorage(fileName = null) {
    if (fileName) {
      this.currentFileName = fileName;
    }

    const content = this.model.getText();
    const saveData = {
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
        this.model.setText(fileData.content);
        this.currentFileName = fileName;

        // Restore cursor and selection
        if (fileData.cursor) {
          this.model.updateCursor(fileData.cursor);
        }
        if (fileData.selection) {
          this.model.setSelection(
            fileData.selection.start,
            fileData.selection.end
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
    this.currentFileName = "untitled.txt";
    this.model.updateCursor({ line: 0, ch: 0 });
    this.model.clearSelection();
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
    try {
      const saved = localStorage.getItem("editor-autosave");
      if (!saved) return true;

      const saveData = JSON.parse(saved);
      return saveData.content !== this.model.getText();
    } catch (error) {
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
    this.focusEditor();
  }

  async handleOpenFile() {
    try {
      const result = await this.importFile();
      this.focusEditor();
      if (this.view) {
        this.view.render();
      }
      console.log(`Opened file: ${result.fileName} (${result.size} bytes)`);
    } catch (error) {
      if (error.message !== "No file selected") {
        console.error("Open file failed:", error);
        alert("Failed to open file: " + error.message);
      }
      this.focusEditor();
    }
  }

  handleSaveFile() {
    const fileName = prompt("Enter filename:", this.currentFileName);
    if (fileName) {
      this.saveToLocalStorage(fileName);
      console.log(`Saved as: ${fileName}`);
    }
    this.focusEditor();
  }

  handleExportFile() {
    this.exportFile();
    this.focusEditor();
  }

  handleManageFiles() {
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
          <button class="btn" data-action="close">Close</button>
        </div>
      </div>
    `;

    const fileList = modal.querySelector(".file-list");
    const savedFiles = this.getSavedFiles();

    if (Object.keys(savedFiles).length === 0) {
      fileList.innerHTML = "<p>No saved files</p>";
    } else {
      Object.entries(savedFiles).forEach(([fileName, fileData]) => {
        const fileItem = document.createElement("div");
        fileItem.className = "file-item";
        fileItem.innerHTML = `
          <span class="file-name">${fileName}</span>
          <span class="file-date">${new Date(
            fileData.timestamp
          ).toLocaleString()}</span>
          <button class="btn-small" data-action="load" data-filename="${fileName}">Load</button>
          <button class="btn-small btn-danger" data-action="delete" data-filename="${fileName}">Delete</button>
        `;
        fileList.appendChild(fileItem);
      });
    }

    modal.addEventListener("click", (e) => {
      const action = e.target.dataset.action;
      const fileName = e.target.dataset.filename;

      if (action === "close") {
        document.body.removeChild(modal);
        // Restore focus to editor when modal closes
        this.focusEditor();
      } else if (action === "load") {
        if (this.loadFromLocalStorage(fileName)) {
          if (this.view) {
            this.view.render();
          }
          this.focusEditor();
          document.body.removeChild(modal);
        }
      } else if (action === "delete") {
        if (confirm(`Delete file "${fileName}"?`)) {
          this.deleteFromLocalStorage(fileName);
          this.showFileManager(); // Refresh the modal
          document.body.removeChild(modal);
          // Focus will be handled by the new modal
        }
      }
    });

    document.body.appendChild(modal);
  }

  // Helper method to focus editor
  focusEditor() {
    if (this.hiddenInput) {
      this.hiddenInput.focus();
    }
    // Force a re-render to ensure cursor is visible
    if (this.view) {
      this.view.render();
    }
  }
}
