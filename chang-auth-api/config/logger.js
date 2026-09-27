const pino = require('pino');

// One JSON object per line, e.g.
//   {"level":"info","time":"...","reqId":"...","event":"login_failed","userId":7,"msg":"..."}
// Log tools (Loki, CloudWatch, ELK, ...) can search and filter these fields.
// For readable output while developing: npm run dev (pipes through pino-pretty).
const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { service: 'chang-auth-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) }, // "info" instead of 30
  // Never write tokens or passwords to the logs.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.currentPassword',
      '*.newPassword',
      '*.token',
    ],
    censor: '[redacted]',
  },
});

module.exports = logger;
