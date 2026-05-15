// File Path: /routes/categories.js
// Purpose: Admin-only CRUD for product categories
// Linked Files: db/db.js, middleware/auth.js, middleware/authAdmin.js

const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { verifyToken } = require('../middleware/auth');
const authAdmin = require('../middleware/authAdmin');

// All routes below require admin authentication
router.use(verifyToken, authAdmin);

// GET /api/categories – list all categories
router.get('/', async (req, res) => {
  try {
    const query = 'SELECT id, name, description, "createdAt" FROM "Category" ORDER BY name';
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Categories fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/categories – create new category
router.post('/', async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required.' });
  }
  try {
    const query = `
      INSERT INTO "Category" ("name", "description")
      VALUES ($1, $2)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [name.trim(), description || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    // handle unique constraint violation
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A category with that name already exists.' });
    }
    console.error('Category create error:', err.message);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id – update category
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required.' });
  }
  try {
    const query = `
      UPDATE "Category"
      SET "name" = $1, "description" = $2, "updatedAt" = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const { rows } = await pool.query(query, [name.trim(), description || null, id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A category with that name already exists.' });
    }
    console.error('Category update error:', err.message);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/admin/categories/:id – delete a category (cascade deletes products)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // First check if any product in this category has order items (to give a clear error)
    const orderCheck = await pool.query(`
      SELECT COUNT(*) AS "count"
      FROM "OrderItem" oi
      JOIN "Product" p ON oi."productId" = p."id"
      WHERE p."categoryId" = $1
    `, [id]);

    if (parseInt(orderCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete this category because it contains products that are part of existing orders. You can remove those products from the storefront by setting their stock to 0 instead.'
      });
    }

    // If no orders exist for products in this category, proceed with deletion (cascade will remove products)
    const query = 'DELETE FROM "Category" WHERE id = $1 RETURNING *';
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted (products removed)', category: rows[0] });
  } catch (err) {
    // Fallback for any other foreign key violation
    if (err.code === '23503') {
      return res.status(400).json({
        error: 'Cannot delete category because its products are referenced by order items.'
      });
    }
    console.error('Category delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;