const db = require("../database.js");
const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null)
    return res
      .status(401)
      .json({ error: "unauthorized", message: "No token provided." });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({ error: "token_expired", message: "JWT has expired." });
      }
      return res
        .status(401)
        .json({ error: "invalid_token", message: "Invalid token." });
    }
    req.userId = user.id;
    next();
  });
}

function checkDocumentAccess(req, res, next) {
  const documentId = req.params.id;
  const userId = req.userId; // Assuming userId is set by a previous auth middleware

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sql =
    "SELECT role FROM document_users WHERE document_id = ? AND user_id = ?";
  db.get(sql, [documentId, userId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res
        .status(403)
        .json({ error: "Forbidden: You do not have access to this document." });
    }
    req.documentRole = row.role;
    next();
  });
}

function checkDocumentOwner(req, res, next) {
  if (req.documentRole !== "owner") {
    return res.status(403).json({
      error: "Forbidden: Only the document owner can perform this action.",
    });
  }
  next();
}

module.exports = { authenticateToken, checkDocumentAccess, checkDocumentOwner };
