// File Path: /seed.js
// Purpose: Populate empty database tables with sample data, including orders for dashboard
// Linked Files: db/db.js, .env

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db/db');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ---------- Categories ----------
    const insertCategories = `
      INSERT INTO "Category" ("name", "description")
      VALUES 
        ('Men', 'Clothing for men'),
        ('Women', 'Clothing for women')
      ON CONFLICT ("name") DO NOTHING
      RETURNING id, "name"
    `;
    const catResult = await client.query(insertCategories);
    let categories = catResult.rows;
    if (categories.length === 0) {
      // If already exist, fetch them
      const existing = await client.query('SELECT id, "name" FROM "Category"');
      categories = existing.rows;
    }
    const menCategory = categories.find(c => c.name === 'Men');
    const womenCategory = categories.find(c => c.name === 'Women');

    // ---------- Products ----------
    // Use ON CONFLICT (name) to avoid duplicates, but we need a unique constraint – not in schema.
    // We'll just insert if empty.
    const { rows: existingProducts } = await client.query('SELECT COUNT(*) FROM "Product"');
    if (parseInt(existingProducts[0].count) === 0) {
      await client.query(`
        INSERT INTO "Product" ("name", "description", "price", "stock", "images", "categoryId")
        VALUES 
          ('Men''s Cotton T‑Shirt', 'Comfortable everyday tee', 29.99, 100, '{}', $1),
          ('Men''s Slim Jeans', 'Modern slim‑fit jeans', 59.99, 50, '{}', $1),
          ('Women''s Summer Dress', 'Light and flowy dress', 49.99, 70, '{}', $2),
          ('Women''s Denim Jacket', 'Classic denim jacket', 79.99, 30, '{}', $2)
      `, [menCategory.id, womenCategory.id]);
    }

    // ---------- Wilayas ----------
    const { rows: existingWilayas } = await client.query('SELECT COUNT(*) FROM "Wilaya"');
    if (parseInt(existingWilayas[0].count) === 0) {
      const wilayaNames = [
        "Adrar", "Chlef", "Laghouat", "Oum El Bouaghi", "Batna", "Béjaïa", "Biskra", "Béchar", "Blida", "Bouira",
        "Tamanrasset", "Tébessa", "Tlemcen", "Tiaret", "Tizi Ouzou", "Alger", "Djelfa", "Jijel", "Sétif", "Saïda",
        "Skikda", "Sidi Bel Abbès", "Annaba", "Guelma", "Constantine", "Médéa", "Mostaganem", "M'Sila", "Mascara",
        "Ouargla", "Oran", "El Bayadh", "Illizi", "Bordj Bou Arréridj", "Boumerdès", "El Tarf", "Tindouf", "Tissemsilt",
        "El Oued", "Khenchela", "Souk Ahras", "Tipaza", "Mila", "Aïn Defla", "Naâma", "Aïn Témouchent", "Ghardaïa",
        "Relizane", "Timimoun", "Bordj Badji Mokhtar", "Ouled Djellal", "Béni Abbès", "In Salah", "In Guezzam",
        "Touggourt", "Djanet", "El M'Ghair", "El Menia", "Tighennif", "Ténès", "Aïn Turck", "Zeralda", "Boufarik",
        "Sidi Ghilès", "Tigzirt", "Azazga", "Aïn Beïda", "Tebessa 2", "Oran 2"
      ];
      for (let i = 0; i < 69; i++) {
        const name = wilayaNames[i] || `Wilaya ${i + 1}`;
        const fee = (Math.floor(Math.random() * 5) + 5) * 100;
        await client.query('INSERT INTO "Wilaya" ("id", "name", "deliveryFee") VALUES ($1, $2, $3)', [i + 1, name, fee]);
      }
    }

    // ---------- Users (admin + customer) with hashed passwords ----------
    const existingUsers = await client.query('SELECT COUNT(*) FROM "User"');
    if (parseInt(existingUsers.rows[0].count) === 0) {
      const salt = await bcrypt.genSalt(10);
      const adminPassword = await bcrypt.hash('admin123', salt);
      const customerPassword = await bcrypt.hash('password123', salt);

      await client.query(`
    INSERT INTO "User" ("email", "password", "firstName", "lastName", "role", "phone")
    VALUES 
    ('admin@example.com', $1, 'Admin', 'User', 'ADMIN', '+213555000000'),
    ('customer@example.com', $2, 'John', 'Doe', 'CUSTOMER', '+213555123456')
  `, [adminPassword, customerPassword]);
    }

    // ---------- Sample Orders (for dashboard) ----------
    const { rows: productIds } = await client.query('SELECT id, price FROM "Product"');
    if (productIds.length > 0 && parseInt((await client.query('SELECT COUNT(*) FROM "Order"')).rows[0].count) === 0) {
      const userIds = (await client.query('SELECT id FROM "User" LIMIT 1')).rows;
      const wilayaIds = (await client.query('SELECT id FROM "Wilaya" LIMIT 5')).rows;
      const statuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

      // Create 20 orders over the last 30 days
      for (let i = 0; i < 20; i++) {
        const randomProduct = productIds[Math.floor(Math.random() * productIds.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;
        const orderStatus = statuses[Math.floor(Math.random() * statuses.length)];
        const randomDaysAgo = Math.floor(Math.random() * 30);
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - randomDaysAgo);

        const totalAmount = (randomProduct.price * quantity).toFixed(2);
        const userId = userIds[0].id;
        const wilayaId = wilayaIds[Math.floor(Math.random() * wilayaIds.length)].id;

        const orderRes = await client.query(`
          INSERT INTO "Order" ("userId", "wilayaId", address, "totalAmount", status, "createdAt")
          VALUES ($1, $2, '123 Main Street', $3, $4, $5)
          RETURNING id
        `, [userId, wilayaId, totalAmount, orderStatus, orderDate.toISOString()]);

        await client.query(`
          INSERT INTO "OrderItem" ("orderId", "productId", quantity, price)
          VALUES ($1, $2, $3, $4)
        `, [orderRes.rows[0].id, randomProduct.id, quantity, randomProduct.price]);
      }
    }

    await client.query('COMMIT');
    console.log('Seed data inserted successfully (including hashed passwords).');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();