import { Persistence } from "@plot-lines/editor";

export class BackendManager extends Persistence {
  constructor(editor) {
    super(editor);
    this.baseUrl = "http://localhost:3000/api";
  }

  async new(name, userId) {
    const response = await fetch(`${this.baseUrl}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, userId }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  async load(documentId) {
    const response = await fetch(`${this.baseUrl}/documents/${documentId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (result.data && result.data.content) {
      this.editor.getModel().lines = JSON.parse(result.data.content);
    }
    return result.data;
  }

  async saveSnapshot(documentId, content, ot_version) {
    const response = await fetch(`${this.baseUrl}/documents/${documentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, ot_version }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  async getSteps(documentId, version) {
    const response = await fetch(
      `${this.baseUrl}/documents/${documentId}/steps?since=${version}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  async delete(documentId) {
    const response = await fetch(`${this.baseUrl}/documents/${documentId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  async list(userId) {
    const response = await fetch(`${this.baseUrl}/users/${userId}/documents`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${this.status}`);
    }
    const result = await response.json();
    return result.data;
  }

  async manage() {
    console.log("Managing documents on the backend.");
    // Implement backend call to manage documents
  }
}
