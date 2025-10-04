import { Persistence } from "@plot-lines/editor";
import { authService } from "./Auth";

export class BackendManager extends Persistence {
  constructor(editor) {
    super(editor);
    this.baseUrl = "http://localhost:3000/api";
  }

  _getHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };
    const user = authService.getCurrentUser();
    if (user && user.token) {
      headers["Authorization"] = `Bearer ${user.token}`;
    }
    return headers;
  }

  async _fetch(url, options = {}, isRetry = false) {
    const fullUrl = `${this.baseUrl}${url}`;
    const opts = {
      ...options,
      headers: this._getHeaders(),
    };

    const response = await fetch(fullUrl, opts);

    if (response.status === 401 && !isRetry) {
      try {
        await authService.reauthenticate();
        // Retry the request with the new token
        return this._fetch(url, options, true);
      } catch (error) {
        // Re-authentication failed (e.g., user cancelled)
        throw new Error("Authentication required.");
      }
    }

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      let error;
      if (contentType && contentType.includes("application/json")) {
        const result = await response.json();
        error = new Error(
          result.error || `HTTP error! status: ${response.status}`,
        );
      } else {
        const text = await response.text();
        error = new Error(text || `HTTP error! status: ${response.status}`);
      }
      throw error;
    }

    return response.json();
  }

  async new(name, userId) {
    return this._fetch("/documents", {
      method: "POST",
      body: JSON.stringify({ name, userId }),
    });
  }

  async load(documentId) {
    const result = await this._fetch(`/documents/${documentId}`);
    if (result.data && result.data.content) {
      this.editor.getModel().lines = JSON.parse(result.data.content);
    }
    return result.data;
  }

  async createSnapshot(documentId, content, ot_version) {
    return this._fetch(`/documents/${documentId}/snapshots`, {
      method: "POST",
      body: JSON.stringify({ content, ot_version }),
    });
  }

  async getSteps(documentId, ot_version) {
    return this._fetch(`/documents/${documentId}/steps?since=${ot_version}`);
  }

  async delete(documentId) {
    return this._fetch(`/documents/${documentId}`, {
      method: "DELETE",
    });
  }

  async list(userId) {
    const result = await this._fetch(`/users/${userId}/documents`);
    return result.data;
  }

  async getCollaborators(documentId) {
    const result = await this._fetch(`/documents/${documentId}/collaborators`);
    return result.data;
  }

  async addCollaborator(documentId, email) {
    return this._fetch(`/documents/${documentId}/collaborators`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async removeCollaborator(documentId, userId) {
    return this._fetch(`/documents/${documentId}/collaborators/${userId}`, {
      method: "DELETE",
    });
  }

  async manage() {
    console.log("Managing documents on the backend.");
    // Implement backend call to manage documents
  }
}
