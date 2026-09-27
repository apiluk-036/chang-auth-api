const express = require('express');
const { listUsers, updateRole } = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = authMiddleware;

const router = express.Router();

// Every route here needs a logged-in admin.
router.use(authMiddleware, requireRole('admin'));

router.get('/users', listUsers);
router.patch('/users/:id(\\d+)/role', updateRole);

module.exports = router;
