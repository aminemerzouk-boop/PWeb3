// File Path: /routes/dashboard.js
// Purpose: Dashboard API – sales/revenue, orders, inventory for admin
// Linked Files: db/db.js, middleware/authAdmin.js

const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const authAdmin = require('../middleware/authAdmin');
const { verifyToken } = require('../middleware/auth');
// All endpoints require admin token
router.use(verifyToken, authAdmin);

// GET /api/dashboard/revenue?period=today|week|month|year  (default: month)
router.get('/revenue', async (req, res) => {
  try {
    const period = req.query.period || 'month';
    let dateCondition;
    const now = new Date();
    if (period === 'today') {
      dateCondition = `DATE("createdAt") = CURRENT_DATE`;
    } else if (period === 'week') {
      dateCondition = `"createdAt" >= date_trunc('week', CURRENT_DATE)`;
    } else if (period === 'year') {
      dateCondition = `"createdAt" >= date_trunc('year', CURRENT_DATE)`;
    } else { // month
      dateCondition = `"createdAt" >= date_trunc('month', CURRENT_DATE)`;
    }

    // Total revenue (gross) and units sold and order count
    const statsQuery = `
      SELECT 
        COALESCE(SUM(oi."price" * oi."quantity"), 0) AS "totalRevenue",
        COALESCE(SUM(oi."quantity"), 0) AS "unitsSold",
        COUNT(DISTINCT o."id") AS "orderCount"
      FROM "Order" o
      JOIN "OrderItem" oi ON oi."orderId" = o."id"
      WHERE o."status" != 'CANCELLED' AND ${dateCondition}
    `;
    const statsResult = await pool.query(statsQuery);
    const { totalRevenue, unitsSold, orderCount } = statsResult.rows[0];

    // Refunds (cancelled orders total in period)
    const refundQuery = `
      SELECT COALESCE(SUM(oi."price" * oi."quantity"), 0) AS "refunds"
      FROM "Order" o
      JOIN "OrderItem" oi ON oi."orderId" = o."id"
      WHERE o."status" = 'CANCELLED' AND ${dateCondition}
    `;
    const refundResult = await pool.query(refundQuery);
    const refunds = parseFloat(refundResult.rows[0].refunds);

    res.json({
      totalRevenue: parseFloat(totalRevenue),
      unitsSold: parseInt(unitsSold),
      orderCount,
      refunds,
      netRevenue: parseFloat(totalRevenue) - refunds,
    });
  } catch (err) {
    console.error('Dashboard revenue error:', err.message);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// GET /api/dashboard/revenue-trend – daily revenue for last 30 days
router.get('/revenue-trend', async (req, res) => {
  try {
    const query = `
      SELECT 
        DATE("o"."createdAt") AS "date",
        COALESCE(SUM(oi."price" * oi."quantity"), 0) AS "revenue"
      FROM "Order" o
      JOIN "OrderItem" oi ON oi."orderId" = o."id"
      WHERE o."status" != 'CANCELLED'
        AND "o"."createdAt" >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE("o"."createdAt")
      ORDER BY DATE("o"."createdAt")
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Revenue trend error:', err.message);
    res.status(500).json({ error: 'Failed to fetch revenue trend' });
  }
});

// GET /api/dashboard/revenue-by-category – returns revenue by all categories (including zero)
router.get('/revenue-by-category', async (req, res) => {
  try {
    const query = `
      SELECT 
        c."name" AS "categoryName",
        COALESCE(SUM(oi."price" * oi."quantity"), 0)::FLOAT AS "revenue"
      FROM "Category" c
      LEFT JOIN "Product" p ON p."categoryId" = c."id"
      LEFT JOIN "OrderItem" oi ON oi."productId" = p."id"
      LEFT JOIN "Order" o ON oi."orderId" = o."id" 
        AND o."status" != 'CANCELLED' 
        AND o."createdAt" >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY c."name"
      ORDER BY "revenue" DESC
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Revenue by category error:', err.message);
    res.status(500).json({ error: 'Failed to fetch revenue by category' });
  }
});
// GET /api/dashboard/orders-summary
router.get('/orders-summary', async (req, res) => {
  try {
    const query = `
      SELECT "status", COUNT(*)::INT AS "count"
      FROM "Order"
      GROUP BY "status"
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Orders summary error:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders summary' });
  }
});

// GET /api/dashboard/inventory-alerts – low stock (<=5) and out of stock
router.get('/inventory-alerts', async (req, res) => {
  try {
    const lowStockQuery = `
      SELECT "name", "stock", "images"
      FROM "Product"
      WHERE "stock" <= 5 AND "stock" > 0
      ORDER BY "stock" ASC
    `;
    const outOfStockQuery = `
      SELECT "name", "stock", "images"
      FROM "Product"
      WHERE "stock" = 0
    `;
    const [lowStockRes, outOfStockRes] = await Promise.all([
      pool.query(lowStockQuery),
      pool.query(outOfStockQuery)
    ]);
    res.json({
      lowStock: lowStockRes.rows,
      outOfStock: outOfStockRes.rows,
    });
  } catch (err) {
    console.error('Inventory alerts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch inventory alerts' });
  }
});

// GET /api/dashboard/product-performance
router.get('/product-performance', async (req, res) => {
  try {
    // Units sold per product (including cancelled orders excluded)
    const unitsSoldQuery = `
      SELECT 
        p."id",
        p."name",
        p."images",
        COALESCE(SUM(oi."quantity"), 0)::INT AS "unitsSold"
      FROM "Product" p
      LEFT JOIN "OrderItem" oi ON oi."productId" = p."id"
      LEFT JOIN "Order" o ON oi."orderId" = o."id" AND o."status" != 'CANCELLED'
      GROUP BY p."id", p."name", p."images"
    `;
    const { rows: allProducts } = await pool.query(unitsSoldQuery);

    // Sort descending for top 10
    const topSelling = [...allProducts]
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 10);

    // Sort ascending for worst 10 (include zero sales)
    const worstSelling = [...allProducts]
      .sort((a, b) => a.unitsSold - b.unitsSold)
      .slice(0, 10);

    // Out of stock and low stock from products table (already have endpoint, but we can include here too)
    const stockQuery = `
      SELECT "name", "stock", "images"
      FROM "Product"
      WHERE "stock" = 0 OR "stock" <= 5
      ORDER BY "stock" ASC
    `;
    const { rows: stockAlerts } = await pool.query(stockQuery);
    const outOfStock = stockAlerts.filter(p => p.stock === 0);
    const lowStock = stockAlerts.filter(p => p.stock > 0 && p.stock <= 5);

    res.json({
      topSelling,
      worstSelling,
      outOfStock,
      lowStock,
    });
  } catch (err) {
    console.error('Product performance error:', err.message);
    res.status(500).json({ error: 'Failed to fetch product performance' });
  }
});

module.exports = router;