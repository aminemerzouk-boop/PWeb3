// File Path: /app.js
// Purpose: Express server, static files, API routes, protected admin
// Linked Files: many routes, middleware/auth.js, middleware/authAdmin.js

require('dotenv').config();
const express = require('express');
const path = require('path');
const apiRouter = require('./routes/api');
const productsRouter = require('./routes/products');
const uploadRouter = require('./routes/upload');
const dashboardRouter = require('./routes/dashboard');
const ordersRouter = require('./routes/orders');
const inventoryRouter = require('./routes/inventory');
const wilayasRouter = require('./routes/wilayas');
const adminCategoriesRouter = require('./routes/categories');
const authRouter = require('./routes/auth');

const { verifyToken } = require('./middleware/auth');
const authAdmin = require('./middleware/authAdmin');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// JSON parsing
app.use(express.json());

// Public API routes
app.use('/api', apiRouter);
app.use('/api/products', productsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/orders', ordersRouter);          // public POST, admin GET/PUT are protected inside
app.use('/api/auth', authRouter);              // login/register
app.use('/api/wilayas', wilayasRouter);
//app.use('/api/categories', categoriesRouter);

// Protected admin routes
app.use('/api/dashboard', verifyToken, authAdmin, dashboardRouter);
app.use('/api/inventory', verifyToken, authAdmin, inventoryRouter);
app.use('/api/admin/categories', adminCategoriesRouter);

// Admin page – JWT required + admin role
app.get('/admin', verifyToken, authAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_VALUE !== 'test') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;