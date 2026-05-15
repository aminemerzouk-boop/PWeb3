// File Path: /db/db.js
// Purpose: PostgreSQL connection pool using Supabase pooler (SSL required)
// Linked Files: .env

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  // Optional: longer connection timeout (helps on slow networks)
  connectionTimeoutMillis: 10000,
});

module.exports = pool;