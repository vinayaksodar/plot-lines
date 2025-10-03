const express = require("express");
const { getUserDocuments } = require("../controllers/userController.js");
const router = express.Router();

router.get("/:userId/documents", getUserDocuments);

module.exports = router;
