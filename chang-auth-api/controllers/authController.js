const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');

const SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  return EMAIL_REGEX.test(email) && email.length <= 255;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function publicUser(row) {
  return { id: row.id, email: row.email, fullName: row.full_name, role: row.role };
}

/**
 * POST /api/auth/register
 * body: { email, password, fullName }
 * New accounts are always 'user'. 'staff' / 'agency' must be granted by an admin,
 * otherwise anyone could sign themselves up with elevated rights.
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
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }
    if (password.length > 72) {
      // bcrypt ignores everything after 72 bytes
      return res.status(400).json({ message: 'Password must be at most 72 characters long.' });
    }

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

    const user = { id: result.insertId, email, full_name: fullName, role: 'user' };
    const token = signToken(user);

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: publicUser(user),
    });
  } catch (err) {
    console.error('Register error:', err);
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
      'SELECT id, email, password_hash, full_name, role FROM users WHERE email = ?',
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
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    const token = signToken(user);

    return res.status(200).json({
      message: 'Logged in successfully.',
      token,
      user: publicUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Something went wrong while logging in.' });
  }
}

/**
 * GET /api/auth/me
 * header: Authorization: Bearer <token>
 * Reads the user fresh from the database, so a deleted account or changed role shows up.
 */
async function me(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, full_name, role FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Account no longer exists.' });
    }
    return res.status(200).json({ user: publicUser(rows[0]) });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

module.exports = { register, login, me };
