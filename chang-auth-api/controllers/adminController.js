const pool = require('../config/db');
const { publicUser } = require('./authController');

const ROLES = ['user', 'staff', 'agency', 'admin'];
const PAGE_SIZE = 20;

/**
 * GET /api/admin/users?q=<email or name>&page=1
 */
async function listUsers(req, res) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 255) : '';
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

    const where = q ? 'WHERE email LIKE ? OR full_name LIKE ?' : '';
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const params = q ? [like, like] : [];

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users ${where}`, params);
    const [rows] = await pool.query(
      `SELECT id, email, full_name, role, email_verified_at, created_at
       FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]
    );

    return res.json({
      users: rows.map((r) => ({ ...publicUser(r), createdAt: r.created_at })),
      total,
      page,
      pageSize: PAGE_SIZE,
      roles: ROLES,
    });
  } catch (err) {
    req.log.error({ err }, 'list users error');
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

/**
 * PATCH /api/admin/users/:id/role
 * body: { role }
 * Takes effect on the user's next request (authMiddleware reads the role from the DB).
 */
async function updateRole(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const { role } = req.body;

    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: `Role must be one of: ${ROLES.join(', ')}.` });
    }
    if (id === req.user.id) {
      // Stops the last admin from locking everyone out of this page by accident.
      return res.status(400).json({ message: 'You cannot change your own role.' });
    }

    const [rows] = await pool.query('SELECT id, role FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });

    const oldRole = rows[0].role;
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    const [[updated]] = await pool.query(
      'SELECT id, email, full_name, role, email_verified_at, created_at FROM users WHERE id = ?',
      [id]
    );

    req.log.info(
      { event: 'role_changed', adminId: req.user.id, userId: id, from: oldRole, to: role },
      'role changed'
    );
    return res.json({ message: 'Role updated.', user: { ...publicUser(updated), createdAt: updated.created_at } });
  } catch (err) {
    req.log.error({ err }, 'update role error');
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

module.exports = { listUsers, updateRole, ROLES };
