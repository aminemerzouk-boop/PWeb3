// File Path: /routes/inventory.js
// Purpose: Inventory analytics API (admin only)
// Linked Files: db/db.js, middleware/authAdmin.js

const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const authAdmin = require('../middleware/authAdmin');

router.use(authAdmin);

// GET /api/inventory
router.get('/', async (req, res) => {
  try {
    // Total stock value: sum(price * stock)
    const valueQuery = `
      SELECT COALESCE(SUM("price" * "stock"), 0) AS "totalStockValue"
      FROM "Product"
    `;
    const valueResult = await pool.query(valueQuery);
    const totalStockValue = parseFloat(valueResult.rows[0].totalStockValue);

    // Stock by category (units and value)
    const categoryQuery = `
      SELECT 
        c."name" AS "categoryName",
        COUNT(p."id")::INT AS "productCount",
        COALESCE(SUM(p."stock"), 0)::INT AS "totalUnits",
        COALESCE(SUM(p."price" * p."stock"), 0)::FLOAT AS "totalValue"
      FROM "Product" p
      JOIN "Category" c ON p."categoryId" = c."id"
      GROUP BY c."name"
      ORDER BY "totalValue" DESC
    `;
    const { rows: categoryStats } = await pool.query(categoryQuery);

    // Aging products (based on createdAt)
    const agingQuery = `
      SELECT 
        "id",
        "name",
        "stock",
        "images",
        "createdAt",
        EXTRACT(DAY FROM NOW() - "createdAt")::INT AS "daysOld"
      FROM "Product"
      WHERE "stock" > 0
        AND "createdAt" <= NOW() - INTERVAL '30 days'
      ORDER BY "createdAt" ASC
    `;
    const { rows: agingProducts } = await pool.query(agingQuery);

    // Separate into 30+, 60+, 90+ buckets
    const aging30 = agingProducts.filter(p => p.daysOld >= 30 && p.daysOld < 60);
    const aging60 = agingProducts.filter(p => p.daysOld >= 60 && p.daysOld < 90);
    const aging90 = agingProducts.filter(p => p.daysOld >= 90);

    res.json({
      totalStockValue,
      categoryStats,
      aging: {
        over30: aging30,
        over60: aging60,
        over90: aging90,
      },
    });
  } catch (err) {
    console.error('Inventory API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch inventory data' });
  }
});

module.exports = router;