
const express = require('express');
const app = express();
const port = 3000;
const db = require('./src/database.js');

app.get('/api/projects', (req, res) => {
    const sql = "select * from projects"
    const params = []
    db.all(sql, params, (err, rows) => {
        if (err) {
          res.status(400).json({"error":err.message});
          return;
        }
        res.json({
            "message":"success",
            "data":rows
        })
      });
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
