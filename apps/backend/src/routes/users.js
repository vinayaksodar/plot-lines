const express = require('express');
const db = require('../database.js');
const router = express.Router();

router.get("/:userId/documents", (req, res) => {
  const { userId } = req.params;
  const sql = "SELECT * FROM documents WHERE user_id = ?";
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({
      message: "success",
      data: rows,
    });
  });
});

module.exports = router;