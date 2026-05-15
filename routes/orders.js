// File Path: /routes/orders.js
// Purpose: Order management – guest checkout (public), customer orders, admin CRUD
// Linked Files: db/db.js, middleware/auth.js, middleware/authAdmin.js

const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { verifyToken } = require('../middleware/auth');
const authAdmin = require('../middleware/authAdmin');

// ---------- PUBLIC: Guest checkout (no token required) ----------
router.post('/', async (req, res) => {
  const { email, firstName, lastName, phone, address, wilayaId, items } = req.body;
  if (!email || !firstName || !lastName || !address || !wilayaId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields: email, firstName, lastName, address, wilayaId, items' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lookup or create user
    let userRes = await client.query('SELECT id FROM "User" WHERE email = $1', [email]);
    let userId;
    if (userRes.rows.length === 0) {
      const newUser = await client.query(
        `INSERT INTO "User" ("email", "password", "firstName", "lastName", "phone")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [email, 'guest', firstName, lastName, phone || null]
      );
      userId = newUser.rows[0].id;
    } else {
      userId = userRes.rows[0].id;
    }

    // 2. Calculate total amount (products + delivery)
    let totalAmount = 0;
    for (const item of items) {
      const productRes = await client.query('SELECT price FROM "Product" WHERE id = $1', [item.productId]);
      if (productRes.rows.length === 0) throw new Error(`Product not found: ${item.productId}`);
      totalAmount += parseFloat(productRes.rows[0].price) * item.quantity;
    }
    const wilayaRes = await client.query('SELECT "deliveryFee" FROM "Wilaya" WHERE id = $1', [wilayaId]);
    if (wilayaRes.rows.length === 0) throw new Error('Invalid wilaya');
    const deliveryFee = parseFloat(wilayaRes.rows[0].deliveryFee);
    totalAmount += deliveryFee;

    // 3. Insert order
    const orderRes = await client.query(
      `INSERT INTO "Order" ("userId", "wilayaId", "address", "totalAmount", "status")
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING id`,
      [userId, wilayaId, address, totalAmount.toFixed(2)]
    );
    const orderId = orderRes.rows[0].id;

    // 4. Insert order items and update stock
    for (const item of items) {
      const productRes = await client.query('SELECT price FROM "Product" WHERE id = $1', [item.productId]);
      const price = productRes.rows[0].price;
      await client.query(
        `INSERT INTO "OrderItem" ("orderId", "productId", "quantity", "price")
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.productId, item.quantity, price]
      );
      await client.query('UPDATE "Product" SET stock = stock - $1 WHERE id = $2', [item.quantity, item.productId]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Order placed successfully', orderId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Failed to place order: ' + err.message });
  } finally {
    client.release();
  }
});

// ---------- AUTHENTICATED: Customer's own orders ----------
router.get('/my', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const ordersQuery = `
      SELECT 
        o."id",
        o."totalAmount",
        o."status",
        o."createdAt",
        o."address",
        w."name" AS "wilayaName"
      FROM "Order" o
      JOIN "Wilaya" w ON o."wilayaId" = w."id"
      WHERE o."userId" = $1
      ORDER BY o."createdAt" DESC
    `;
    const { rows: orders } = await pool.query(ordersQuery, [userId]);

    // Fetch items for each order
    for (let order of orders) {
      const itemsQuery = `
        SELECT 
          oi."quantity",
          oi."price",
          p."name" AS "productName",
          p."images"
        FROM "OrderItem" oi
        JOIN "Product" p ON oi."productId" = p."id"
        WHERE oi."orderId" = $1
      `;
      const { rows: items } = await pool.query(itemsQuery, [order.id]);
      order.items = items;
    }
    res.json(orders);
  } catch (err) {
    console.error('My orders error:', err.message);
    res.status(500).json({ error: 'Failed to fetch your orders' });
  }
});

// ---------- ADMIN-ONLY ROUTES (require token + admin role) ----------
router.use(verifyToken, authAdmin);

// Admin list of all orders (with optional status filter)
router.get('/', async (req, res) => {
  try {
    const statusFilter = req.query.status;
    let query = `
      SELECT 
        o."id",
        o."totalAmount",
        o."status",
        o."createdAt",
        o."address",
        o."userId",
        u."email" AS "customerEmail",
        u."firstName" || ' ' || u."lastName" AS "customerName",
        w."name" AS "wilayaName"
      FROM "Order" o
      JOIN "User" u ON o."userId" = u."id"
      JOIN "Wilaya" w ON o."wilayaId" = w."id"
    `;
    const params = [];
    if (statusFilter) {
      query += ` WHERE o."status" = $1`;
      params.push(statusFilter);
    }
    query += ` ORDER BY o."createdAt" DESC`;

    const { rows: orders } = await pool.query(query, params);

    // Fetch items for each order
    for (let order of orders) {
      const itemsQuery = `
        SELECT 
          oi."quantity",
          oi."price",
          p."name" AS "productName",
          p."images"
        FROM "OrderItem" oi
        JOIN "Product" p ON oi."productId" = p."id"
        WHERE oi."orderId" = $1
      `;
      const { rows: items } = await pool.query(itemsQuery, [order.id]);
      order.items = items;
    }

    res.json(orders);
  } catch (err) {
    console.error('Orders API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Admin update order status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const query = `
      UPDATE "Order"
      SET "status" = $1, "updatedAt" = NOW()
      WHERE "id" = $2
      RETURNING *
    `;
    const { rows } = await pool.query(query, [status, id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Update order status error:', err.message);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;