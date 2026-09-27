const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');

// The JWT only carries the user id and token_version. authMiddleware looks the
// user up on every request, so email / role changes apply immediately and
// bumping token_version logs every existing token out.
function signToken(user) {
  return jwt.sign({ id: user.id, tv: user.token_version ?? 0 }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

// Logs the user out everywhere: every token issued before this call stops working.
async function revokeAllTokens(userId, conn = pool) {
  await conn.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId]);
}

const TOKEN_TTL_MINUTES = {
  verify_email: 24 * 60, // 24 hours
  reset_password: 60, // 1 hour
};

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a one-time token for an email link and returns the plain token.
 * Older unused tokens of the same purpose are removed, so only the newest link works.
 */
async function createEmailToken(userId, purpose) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?', [userId, purpose]);
  await pool.query(
    `INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`,
    [userId, purpose, hashToken(token), TOKEN_TTL_MINUTES[purpose]]
  );
  return token;
}

/**
 * Marks a token as used and returns its user_id, or null if the token is
 * unknown, expired, already used or for another purpose.
 * The UPDATE ... WHERE used_at IS NULL makes it single-use even under a race.
 */
async function consumeEmailToken(token, purpose, conn = pool) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = hashToken(token);
  const [result] = await conn.query(
    `UPDATE email_tokens SET used_at = UTC_TIMESTAMP()
     WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
    [tokenHash, purpose]
  );
  if (result.affectedRows !== 1) return null;
  const [rows] = await conn.query('SELECT user_id FROM email_tokens WHERE token_hash = ?', [tokenHash]);
  return rows[0].user_id;
}

module.exports = { signToken, revokeAllTokens, createEmailToken, consumeEmailToken };
