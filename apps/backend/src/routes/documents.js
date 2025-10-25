const express = require("express");
const {
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
} = require("../controllers/documentController.js");
const { checkDocumentAccess, checkDocumentOwner } = require("./middleware.js");
const router = express.Router();

router.get("/:id", checkDocumentAccess, getDocument);

router.post("/", createNewDocument);

router.put("/:id", checkDocumentAccess, checkDocumentOwner, renameDocument);

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

router.put("/:id/titlepage", updateTitlePageHandler); // Add the new route here

module.exports = router;
