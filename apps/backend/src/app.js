const express = require('express');
const cors = require('cors');
const documentRoutes = require('./routes/documents');
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/documents', documentRoutes);
app.use('/api/users', userRoutes);
app.use('/api', authRoutes);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

module.exports = app;
