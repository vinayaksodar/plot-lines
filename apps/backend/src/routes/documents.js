const express = require("express");
const {
  getDocument,
  createNewDocument,
  deleteDocument,
  createSnapshot,
  getSteps,
  addCollaborator,
  removeCollaborator,
  getCollaborators,
} = require("../controllers/documentController.js");
const { checkDocumentAccess, checkDocumentOwner } = require("./middleware.js");
const router = express.Router();

router.get("/:id", checkDocumentAccess, getDocument);

router.post("/", createNewDocument);

router.delete("/:id", checkDocumentAccess, checkDocumentOwner, deleteDocument);

router.post("/:id/snapshots", checkDocumentAccess, createSnapshot);

router.get("/:id/steps", checkDocumentAccess, getSteps);

router.post(
  "/:id/collaborators",
  checkDocumentAccess,
  checkDocumentOwner,
  addCollaborator,
);

router.delete(
  "/:id/collaborators/:userId",
  checkDocumentAccess,
  removeCollaborator,
);

router.get("/:id/collaborators", checkDocumentAccess, getCollaborators);

module.exports = router;
