// File Path: /routes/products.js
// Purpose: Product CRUD API – GET public, POST/PUT/DELETE require admin token
// Linked Files: db/db.js, middleware/authAdmin.js

const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { verifyToken } = require('../middleware/auth');
const authAdmin = require('../middleware/authAdmin');

// GET /api/products – public, returns all products with category name
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        p."id",
        p."name",
        p."description",
        p."price",
        p."stock",
        p."images",
        p."categoryId",
        c."name" AS "categoryName",
        p."createdAt"
      FROM "Product" p
      JOIN "Category" c ON p."categoryId" = c."id"
      ORDER BY p."createdAt" DESC
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching products:', err.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id – public, returns a single product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        p."id",
        p."name",
        p."description",
        p."price",
        p."stock",
        p."images",
        p."categoryId",
        c."name" AS "categoryName",
        p."createdAt"
      FROM "Product" p
      JOIN "Category" c ON p."categoryId" = c."id"
      WHERE p."id" = $1
    `;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching product:', err.message);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products – create new product (admin only)
router.post('/', verifyToken, authAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, images, categoryId } = req.body;
    if (!name || !description || !price || !stock || !categoryId) {
      return res.status(400).json({ error: 'Missing required fields: name, description, price, stock, categoryId' });
    }
    const query = `
      INSERT INTO "Product" ("name", "description", "price", "stock", "images", "categoryId")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [name, description, price, stock, images || [], categoryId];
    const { rows } = await pool.query(query, values);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating product:', err.message);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id – update product (admin only)
router.put('/:id', verifyToken, authAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, images, categoryId } = req.body;
    const fields = [];
    const values = [];
    let paramCount = 1;
    if (name !== undefined) { fields.push(`"name" = $${paramCount++}`); values.push(name); }
    if (description !== undefined) { fields.push(`"description" = $${paramCount++}`); values.push(description); }
    if (price !== undefined) { fields.push(`"price" = $${paramCount++}`); values.push(price); }
    if (stock !== undefined) { fields.push(`"stock" = $${paramCount++}`); values.push(stock); }
    if (images !== undefined) { fields.push(`"images" = $${paramCount++}`); values.push(images); }
    if (categoryId !== undefined) { fields.push(`"categoryId" = $${paramCount++}`); values.push(categoryId); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const query = `
      UPDATE "Product"
      SET ${fields.join(', ')}
      WHERE "id" = $${paramCount}
      RETURNING *
    `;
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating product:', err.message);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id – delete product (admin only)
router.delete('/:id', verifyToken, authAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // First check if the product has any order items (to give a meaningful error)
    const orderCheck = await pool.query(
      'SELECT COUNT(*) AS "count" FROM "OrderItem" WHERE "productId" = $1',
      [id]
    );
    if (parseInt(orderCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete this product because it is part of existing orders. You can remove it from the storefront by setting stock to 0 instead.'
      });
    }
    // Also check for cart references? (not needed – carts are client‑side only)

    const query = 'DELETE FROM "Product" WHERE "id" = $1 RETURNING *';
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted', product: rows[0] });
  } catch (err) {
    // Fallback: if the foreign key check was bypassed (unlikely), we still handle the DB error
    if (err.code === '23503') { // foreign_key_violation
      return res.status(400).json({
        error: 'Cannot delete product because it is referenced by order items.'
      });
    }
    console.error('Error deleting product:', err.message);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;