const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

// Counters live in this process's memory: they reset on restart and are not
// shared between several Node processes. With more than one process, give
// every limiter a shared store (e.g. rate-limit-redis).

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

function normalizedBodyEmail(req) {
  const email = req.body && req.body.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function limiter({ name, message, ...options }) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message },
    handler: (req, res, next, opts) => {
      (req.log || logger).warn({ event: 'rate_limited', limiter: name }, 'rate limit hit');
      res.status(opts.statusCode).json(opts.message);
    },
    ...options,
  });
}

// Per IP: slows down one machine trying many emails / passwords.
const ipLimiter = limiter({
  name: 'ip',
  windowMs: FIFTEEN_MINUTES,
  limit: Number(process.env.RATE_LIMIT_IP_MAX) || 20,
  message: 'Too many attempts. Please try again in 15 minutes.',
});

// Per email: stops password guessing on one account spread over many IPs.
// Only failed logins count, so a user who logs in fine is never blocked.
const loginEmailLimiter = limiter({
  name: 'login_email',
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  skipSuccessfulRequests: true,
  skip: (req) => !normalizedBodyEmail(req),
  keyGenerator: (req) => `login:${normalizedBodyEmail(req)}`,
  message: 'Too many failed attempts for this email. Please try again in 15 minutes.',
});

// Per email: stops someone flooding a person's inbox with reset emails.
const forgotPasswordEmailLimiter = limiter({
  name: 'forgot_email',
  windowMs: ONE_HOUR,
  limit: 3,
  skip: (req) => !normalizedBodyEmail(req),
  keyGenerator: (req) => `forgot:${normalizedBodyEmail(req)}`,
  message: 'Too many reset requests for this email. Please try again in 1 hour.',
});

// Per logged-in user (use after authMiddleware).
const resendVerificationLimiter = limiter({
  name: 'resend_verification',
  windowMs: ONE_HOUR,
  limit: 3,
  keyGenerator: (req) => `verify:${req.user.id}`,
  message: 'Too many verification emails. Please try again in 1 hour.',
});

module.exports = { ipLimiter, loginEmailLimiter, forgotPasswordEmailLimiter, resendVerificationLimiter };
