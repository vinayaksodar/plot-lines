const Document = require("../models/document.js");

const getUserDocuments = async (req, res) => {
  const { userId } = req.params;
  try {
    const docs = await Document.findByUser(userId);
    res.json({
      message: "success",
      data: docs,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve user documents." });
  }
};

module.exports = {
  getUserDocuments,
};
