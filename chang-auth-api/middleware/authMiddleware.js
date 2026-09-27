const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET } = require('../config/jwt');

/**
 * Requires header: Authorization: Bearer <token>
 * On success sets req.user to the current row from the database
 * ({ id, email, full_name, role, token_version, email_verified_at }).
 *
 * The user is read from the database on every request, so:
 * - logout / password change (token_version bumped) kills old tokens at once
 * - a deleted account or a role changed by an admin applies at once
 */
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Please log in first.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please log in again.'
        : 'Invalid token. Please log in again.';
    return res.status(401).json({ message });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, email, full_name, role, token_version, email_verified_at FROM users WHERE id = ?',
      [payload.id]
    );
    const user = rows[0];
    if (!user || user.token_version !== payload.tv) {
      return res.status(401).json({ message: 'Your session has ended. Please log in again.' });
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Restrict a route to certain roles, e.g. requireRole('staff', 'agency').
 * Use after authMiddleware.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to do this.' });
    }
    return next();
  };
}

/**
 * Blocks users who have not verified their email yet. Use after authMiddleware
 * on routes that need a real, reachable email address.
 */
function requireVerifiedEmail(req, res, next) {
  if (!req.user || !req.user.email_verified_at) {
    return res.status(403).json({ message: 'Please verify your email first.', emailVerified: false });
  }
  return next();
}

module.exports = authMiddleware;
module.exports.requireRole = requireRole;
module.exports.requireVerifiedEmail = requireVerifiedEmail;
