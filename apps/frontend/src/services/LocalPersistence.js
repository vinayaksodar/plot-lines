import { Persistence } from "@plot-lines/editor";

export class LocalPersistence extends Persistence {
  constructor(model, view, titlePage) {
    super(null); // The editor instance will be injected by the Editor.
    this.model = model;
    this.view = view;
    this.titlePage = titlePage;
  }

  getSavedFiles() {
    try {
      const saved = localStorage.getItem("editor-saved-files");
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error("Failed to get saved files:", error);
      return {};
    }
  }

  async save(options) {
    const { documentId, fileName, content } = options;

    if (!documentId) {
      throw new Error("documentId is required for saving.");
    }

    const titlePage = this.titlePage.model.getData();
    const saveData = {
      id: documentId,
      titlePage,
      content: content || JSON.stringify(this.model.lines),
      fileName: fileName,
      timestamp: Date.now(),
    };

    const savedFiles = this.getSavedFiles();
    savedFiles[documentId] = saveData;
    localStorage.setItem("editor-saved-files", JSON.stringify(savedFiles));

    return fileName;
  }

  async load(documentId) {
    try {
      const savedFiles = this.getSavedFiles();
      const fileData = savedFiles[documentId];

      if (fileData) {
        try {
          this.model.lines = JSON.parse(fileData.content);
        } catch (e) {
          console.error("Failed to parse content from saved file", e);
          this.model.setText(fileData.content);
        }
        if (fileData.titlePage) {
          this.titlePage.model.update(fileData.titlePage);
          this.titlePage.render();
        }
        return fileData;
      }
    } catch (error) {
      console.error("Failed to load file:", error);
    }
    return false;
  }

  async rename(documentId, newFileName) {
    const savedFiles = this.getSavedFiles();
    if (savedFiles[documentId]) {
      const fileData = savedFiles[documentId];
      fileData.fileName = newFileName;
      savedFiles[documentId] = fileData;
      localStorage.setItem("editor-saved-files", JSON.stringify(savedFiles));
      return newFileName;
    }
    throw new Error("File not found");
  }

  async delete(documentId) {
    try {
      const savedFiles = this.getSavedFiles();
      delete savedFiles[documentId];
      localStorage.setItem("editor-saved-files", JSON.stringify(savedFiles));
      return true;
    } catch (error) {
      console.error("Failed to delete file:", error);
      return false;
    }
  }

  async list() {
    const savedFiles = this.getSavedFiles();
    return Object.values(savedFiles);
  }
}
