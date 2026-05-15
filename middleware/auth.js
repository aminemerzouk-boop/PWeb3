// File Path: /middleware/auth.js
// Purpose: Verify JWT and attach user to req
// Linked Files: .env (JWT_SECRET)

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_me';

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;  // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = { verifyToken, JWT_SECRET };