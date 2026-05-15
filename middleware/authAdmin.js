// File Path: /middleware/authAdmin.js
// Purpose: Check if the authenticated user is an admin
// Linked Files: middleware/auth.js

module.exports = function authAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};