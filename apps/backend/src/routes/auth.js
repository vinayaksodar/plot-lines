const express = require('express');
const db = require('../database.js');
const router = express.Router();

router.post('/signup', (req, res) => {
    const { name, password } = req.body;
    if (!name || !password) {
        console.error('Signup failed: Name or password missing.');
        return res.status(400).json({ "error": "Name and password are required" });
    }
    // In a real app, you should hash the password
    const sql = 'INSERT INTO users (name, password) VALUES (?,?)';
    db.run(sql, [name, password], function (err, result) {
        if (err) {
            console.error('Signup failed:', err.message);
            return res.status(400).json({ "error": err.message });
        }
        res.json({
            "message": "success",
            "id": this.lastID
        });
    });
});

router.post('/login', (req, res) => {
    const { name, password } = req.body;
    if (!name || !password) {
        console.error('Login failed: Name or password missing.');
        return res.status(400).json({ "error": "Name and password are required" });
    }
    const sql = "SELECT * FROM users WHERE name = ? AND password = ?"
    db.get(sql, [name, password], (err, row) => {
        if (err) {
            console.error('Login failed:', err.message);
            return res.status(400).json({ "error": err.message });
        }
        if (!row) {
            console.error(`Login failed: Invalid credentials for user '${name}'`);
            return res.status(400).json({ "error": "Invalid credentials" });
        }
        res.json({
            "message": "success",
            "data": {
                id: row.id,
                name: row.name,
                is_premium: row.is_premium
            }
        });
    });
});

module.exports = router;
