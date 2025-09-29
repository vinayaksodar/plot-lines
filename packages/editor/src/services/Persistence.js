/**
 * @interface
 * An interface for persistence adapters that can be used with the editor.
 * This allows the editor to be decoupled from the specific implementation of
 * how and where documents are saved (e.g., localStorage, cloud, file system).
 */
export class Persistence {
  constructor(editor) {
    if (this.constructor === Persistence) {
      throw new Error("Persistence is an interface and cannot be instantiated directly.");
    }
    this.editor = editor;
  }

  /**
   * Saves the current document.
   * @param {object} options - Save options, e.g., { fileName: 'new-name.txt' }.
   * @returns {Promise<void>}
   */
  async save(options) {
    throw new Error("Method 'save()' must be implemented.");
  }

  /**
   * Loads a document.
   * @param {string} documentId - The identifier for the document to load.
   * @returns {Promise<object>} - The loaded document data.
   */
  async load(documentId) {
    throw new Error("Method 'load()' must be implemented.");
  }

  /**
   * Creates a new blank document.
   * @returns {Promise<void>}
   */
  async new() {
    throw new Error("Method 'new()' must be implemented.");
  }

  /**
   * Exports the current document to a file.
   * @param {string} format - The format to export to (e.g., 'fountain', 'text').
   * @returns {Promise<void>}
   */
  async export(format) {
    throw new Error("Method 'export()' must be implemented.");
  }

  /**
   * Imports a file to populate the document.
   * @param {string} format - The format of the file being imported.
   * @returns {Promise<void>}
   */
  async import(format) {
    throw new Error("Method 'import()' must be implemented.");
  }
  
  /**
   * Lists available documents.
   * @returns {Promise<Array<object>>} - A list of document metadata.
   */
    async list() {
         throw new Error("Method 'list()' must be implemented.");
    }
  
    /**
     * Opens a UI for managing stored documents, if applicable.
     * @returns {Promise<void>}
     */
    async manage() {
      // This may not be implemented by all adapters
      console.log("This persistence adapter does not provide a management UI.");
    }}
