const Document = require("../models/document.js");
const User = require("../models/user.js");

const getDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: "Document not found." });
    }
    res.json({ message: "success", data: doc });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve document." });
  }
};

const createNewDocument = async (req, res) => {
  const { name, userId } = req.body;
  if (!name || !userId) {
    return res
      .status(400)
      .json({ error: "Documnet name and userId are required." });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (!user.is_premium) {
      const count = await Document.countOwnedByUser(userId);
      if (count > 0) {
        return res.status(403).json({
          error:
            "Free users can only create one cloud document. Please delete your existing cloud document to create a new one.",
        });
      }
    }

    const newDoc = await Document.create(name, userId);
    res.status(201).json({ message: "success", id: newDoc.id });
  } catch (err) {
    res.status(500).json({ error: "Failed to create document." });
  }
};

const deleteDocument = async (req, res) => {
  try {
    await Document.delete(req.params.id);
    res.json({ message: "deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete document." });
  }
};

const createSnapshot = async (req, res) => {
  const { content, ot_version } = req.body;
  try {
    const snapshot = await Document.createSnapshot(
      req.params.id,
      content,
      ot_version,
    );
    res.status(201).json({
      message: "success",
      snapshot_version: snapshot.snapshot_version,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create snapshot." });
  }
};

const getSteps = async (req, res) => {
  const { since } = req.query;
  try {
    const result = await Document.getSteps(req.params.id, since);
    if (result.error === "HISTORY_TOO_OLD") {
      return res.status(410).set("Cache-Control", "no-store").json(result); // 410 Gone
    }
    res.json({ message: "success", ...result });
  } catch (err) {
    res.status(500).json({ error: "Failed to get steps." });
  }
};

const getCollaborators = async (req, res) => {
  try {
    const collaborators = await Document.getCollaborators(req.params.id);
    res.json({ message: "success", data: collaborators });
  } catch (err) {
    res.status(500).json({ error: "Failed to get collaborators." });
  }
};

const addCollaborator = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "No email specified" });
  }
  try {
    await Document.addCollaborator(req.params.id, email);
    res.json({ message: "success" });
  } catch (err) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes("already a collaborator")) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to add collaborator." });
  }
};

const removeCollaborator = async (req, res) => {
  const { userId } = req.params;
  try {
    await Document.removeCollaborator(req.params.id, userId);
    res.json({ message: "success" });
  } catch (err) {
    if (err.message.includes("Cannot remove the owner")) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.includes("not a collaborator")) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to remove collaborator." });
  }
};

const renameDocument = async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "New name is required." });
  }

  try {
    await Document.rename(req.params.id, name);
    res.json({ message: "success" });
  } catch (err) {
    res.status(500).json({ error: "Failed to rename document." });
  }
};

const updateTitlePageHandler = async (req, res) => {
  const { content } = req.body;
  if (content === undefined) {
    return res.status(400).json({ error: "Title page content is required." });
  }

  try {
    await Document.updateTitlePage(req.params.id, content);
    res.json({ message: "success" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update title page." });
  }
};

module.exports = {
  getDocument,
  createNewDocument,
  deleteDocument,
  renameDocument,
  updateTitlePageHandler, // Add the new handler here
  createSnapshot,
  getSteps,
  addCollaborator,
  removeCollaborator,
  getCollaborators,
};
