// File Path: /routes/wilayas.js
// Purpose: Public endpoint to list wilayas for checkout
// Linked Files: db/db.js

const express = require('express');
const router = express.Router();
const pool = require('../db/db');

// GET /api/wilayas
router.get('/', async (req, res) => {
  try {
    console.log('Wilayas endpoint called');  // <-- ADD THIS LINE
    const query = 'SELECT id, name, "deliveryFee" FROM "Wilaya" ORDER BY id';
    const { rows } = await pool.query(query);
    console.log(`Returning ${rows.length} wilayas`);  // <-- ADD THIS
    res.json(rows);
  } catch (err) {
    console.error('Wilayas error:', err.message);
    res.status(500).json({ error: 'Failed to fetch wilayas' });
  }
});

module.exports = router;