const express = require('express');
const auth = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const {
  ipLimiter,
  loginEmailLimiter,
  forgotPasswordEmailLimiter,
  resendVerificationLimiter,
} = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/register', ipLimiter, auth.register);
router.post('/login', ipLimiter, loginEmailLimiter, auth.login);
router.get('/me', authMiddleware, auth.me);
router.post('/logout', authMiddleware, auth.logout);
router.post('/change-password', ipLimiter, authMiddleware, auth.changePassword);

router.post('/forgot-password', ipLimiter, forgotPasswordEmailLimiter, auth.forgotPassword);
router.post('/reset-password', ipLimiter, auth.resetPassword);

router.post('/verify-email', ipLimiter, auth.verifyEmail);
router.post('/resend-verification', authMiddleware, resendVerificationLimiter, auth.resendVerification);

module.exports = router;
