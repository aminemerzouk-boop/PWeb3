// File Path: /routes/auth.js
// Purpose: Login and registration endpoints
// Linked Files: db/db.js, middleware/auth.js, bcryptjs

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/db');
const { JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// POST /api/auth/register (optional, for customers)
router.post('/register', async (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Required fields: email, password, firstName, lastName' });
  }

  try {
    const existing = await pool.query('SELECT id FROM "User" WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      `INSERT INTO "User" ("email", "password", "firstName", "lastName", "phone", "role")
       VALUES ($1, $2, $3, $4, $5, 'CUSTOMER')
       RETURNING id, email, "firstName", "lastName", role`,
      [email, hashedPassword, firstName, lastName, phone || null]
    );

    const user = newUser.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

module.exports = router;