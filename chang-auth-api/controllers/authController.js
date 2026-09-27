const bcrypt = require('bcrypt');
const pool = require('../config/db');
const {
  signToken,
  revokeAllTokens,
  consumeEmailToken,
} = require('../services/tokenService');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

const SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  return EMAIL_REGEX.test(email) && email.length <= 255;
}

// Returns an error message, or null if the password is acceptable.
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 72) {
    // bcrypt ignores everything after 72 bytes
    return 'Password must be at most 72 characters long.';
  }
  return null;
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    emailVerified: !!row.email_verified_at,
  };
}

// Sending email must not fail the request that triggered it (e.g. sign-up).
async function trySend(req, fn, user) {
  try {
    await fn(user);
    return true;
  } catch (err) {
    req.log.error({ err, event: 'mail_failed', userId: user.id }, 'could not send email');
    return false;
  }
}

/**
 * POST /api/auth/register
 * body: { email, password, fullName }
 * New accounts are always 'user'. 'staff' / 'agency' / 'admin' must be granted
 * by an admin, otherwise anyone could sign themselves up with elevated rights.
 * A verification email is sent; the account can log in before verifying.
 */
async function register(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    const fullName =
      typeof req.body.fullName === 'string' && req.body.fullName.trim()
        ? req.body.fullName.trim().slice(0, 255)
        : null;

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ message: problem });

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({
        message: 'An account with this email already exists. Please log in.',
        accountExists: true,
        redirectTo: '/login',
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    let result;
    try {
      [result] = await pool.query(
        'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        [email, passwordHash, fullName, 'user']
      );
    } catch (err) {
      // Two sign-ups with the same email at the same moment
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          message: 'An account with this email already exists. Please log in.',
          accountExists: true,
          redirectTo: '/login',
        });
      }
      throw err;
    }

    const user = {
      id: result.insertId,
      email,
      full_name: fullName,
      role: 'user',
      token_version: 0,
      email_verified_at: null,
    };
    req.log.info({ event: 'user_registered', userId: user.id }, 'user registered');
    const verificationEmailSent = await trySend(req, sendVerificationEmail, user);

    return res.status(201).json({
      message: 'Account created successfully.',
      token: signToken(user),
      user: publicUser(user),
      verificationEmailSent,
    });
  } catch (err) {
    req.log.error({ err }, 'register error');
    return res.status(500).json({ message: 'Something went wrong while creating the account.' });
  }
}

/**
 * POST /api/auth/login
 * body: { email, password }
 * If the email has no account -> 404 with redirectTo: '/register'
 */
async function login(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!isValidEmail(email) || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const [rows] = await pool.query(
      `SELECT id, email, password_hash, full_name, role, token_version, email_verified_at
       FROM users WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'No account found with this email. Please register first.',
        accountExists: false,
        redirectTo: '/register',
      });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      req.log.warn({ event: 'login_failed', userId: user.id }, 'wrong password');
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    req.log.info({ event: 'login', userId: user.id }, 'user logged in');
    return res.status(200).json({
      message: 'Logged in successfully.',
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    req.log.error({ err }, 'login error');
    return res.status(500).json({ message: 'Something went wrong while logging in.' });
  }
}

/**
 * GET /api/auth/me
 * header: Authorization: Bearer <token>
 * authMiddleware already loaded the current row from the database.
 */
function me(req, res) {
  return res.status(200).json({ user: publicUser(req.user) });
}

/**
 * POST /api/auth/logout
 * Ends every session of this user (all devices): all existing tokens stop working.
 */
async function logout(req, res) {
  try {
    await revokeAllTokens(req.user.id);
    req.log.info({ event: 'logout', userId: req.user.id }, 'user logged out');
    return res.status(200).json({ message: 'Logged out.' });
  } catch (err) {
    req.log.error({ err }, 'logout error');
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

/**
 * POST /api/auth/change-password
 * body: { currentPassword, newPassword }
 * Logs out every other device and returns a fresh token for this one.
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || !currentPassword) {
      return res.status(400).json({ message: 'Current password is required.' });
    }
    const problem = passwordProblem(newPassword);
    if (problem) return res.status(400).json({ message: problem });

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
      [passwordHash, req.user.id]
    );
    const [[updated]] = await pool.query(
      'SELECT id, email, full_name, role, token_version, email_verified_at FROM users WHERE id = ?',
      [req.user.id]
    );

    req.log.info({ event: 'password_changed', userId: req.user.id }, 'password changed');
    return res.status(200).json({
      message: 'Password changed.',
      token: signToken(updated),
      user: publicUser(updated),
    });
  } catch (err) {
    req.log.error({ err }, 'change password error');
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

/**
 * POST /api/auth/forgot-password
 * body: { email }
 * Always answers the same way, whether or not the email has an account.
 */
async function forgotPassword(req, res) {
  const answer = { message: 'If this email has an account, a reset link has been sent.' };
  try {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const [rows] = await pool.query('SELECT id, email, full_name FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
      await sendPasswordResetEmail(rows[0]);
      req.log.info({ event: 'password_reset_requested', userId: rows[0].id }, 'reset email sent');
    }
    return res.status(200).json(answer);
  } catch (err) {
    req.log.error({ err }, 'forgot password error');
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

/**
 * POST /api/auth/reset-password
 * body: { token, password }
 * The token comes from the emailed link and works once, within 1 hour.
 * Every existing session of the account is logged out.
 */
async function resetPassword(req, res) {
  const problem = passwordProblem(req.body.password);
  if (problem) return res.status(400).json({ message: problem });

  let conn;
  try {
    const passwordHash = await bcrypt.hash(req.body.password, SALT_ROUNDS);

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const userId = await consumeEmailToken(req.body.token, 'reset_password', conn);
    if (!userId) {
      await conn.rollback();
      return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
    }
    await conn.query(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
      [passwordHash, userId]
    );
    await conn.commit();

    req.log.info({ event: 'password_reset', userId }, 'password reset');
    return res.status(200).json({ message: 'Password has been reset. Please log in.' });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    req.log.error({ err }, 'reset password error');
    return res.status(500).json({ message: 'Something went wrong.' });
  } finally {
    if (conn) conn.release();
  }
}

/**
 * POST /api/auth/verify-email
 * body: { token }
 * The token comes from the emailed link and works once, within 24 hours.
 * (The link opens a page that POSTs here, so email scanners that pre-open
 * links do not use up the token.)
 */
async function verifyEmail(req, res) {
  try {
    const userId = await consumeEmailToken(req.body.token, 'verify_email');
    if (!userId) {
      return res.status(400).json({ message: 'This verification link is invalid or has expired.' });
    }
    await pool.query(
      'UPDATE users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE id = ?',
      [userId]
    );
    req.log.info({ event: 'email_verified', userId }, 'email verified');
    return res.status(200).json({ message: 'Email verified.' });
  } catch (err) {
    req.log.error({ err }, 'verify email error');
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

/**
 * POST /api/auth/resend-verification
 * header: Authorization: Bearer <token>
 */
async function resendVerification(req, res) {
  if (req.user.email_verified_at) {
    return res.status(400).json({ message: 'Email is already verified.' });
  }
  const sent = await trySend(req, sendVerificationEmail, req.user);
  if (!sent) return res.status(502).json({ message: 'Could not send the email. Please try again later.' });
  return res.status(200).json({ message: 'Verification email sent.' });
}

module.exports = {
  register,
  login,
  me,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  publicUser,
};
