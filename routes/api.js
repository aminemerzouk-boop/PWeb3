// File Path: /routes/api.js
// Purpose: General API endpoints (ping, categories)
// Linked Files: db/db.js

const express = require('express');
const router = express.Router();
const pool = require('../db/db');

// Test endpoint
router.get('/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// GET /api/categories – public, returns all categories
router.get('/categories', async (req, res) => {
  try {
    const query = 'SELECT "id", "name" FROM "Category" ORDER BY "name"';
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching categories:', err.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;