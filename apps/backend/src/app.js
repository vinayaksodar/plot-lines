const express = require("express");
const cors = require("cors");
const documentRoutes = require("./routes/documents");
const userRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");
const { authenticateToken } = require("./routes/middleware");

const indexRouter = require("./routes/index");

const app = express();

// app.use(
//   cors({
//     origin: "http://localhost:5173",
//     credentials: true,
//   }),
// );
app.use(express.json());

app.use("/", indexRouter);
app.use("/api/documents", authenticateToken, documentRoutes);
app.use("/api/users", userRoutes);
app.use("/api", authRoutes);

module.exports = app;
