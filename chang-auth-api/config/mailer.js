const nodemailer = require('nodemailer');
const logger = require('./logger');

const env = process.env.NODE_ENV;
const isProd = env === 'production';

// Links in emails are built from APP_URL, never from the request's Host header:
// otherwise an attacker could send a reset email whose link points to their site.
const APP_URL = (process.env.APP_URL || `http://localhost:${Number(process.env.PORT) || 4000}`).replace(/\/+$/, '');
if (isProd && !process.env.APP_URL) {
  throw new Error('APP_URL must be set in production (e.g. https://app.example.com).');
}

const MAIL_FROM = process.env.MAIL_FROM || 'Chang Auth <no-reply@example.com>';

// SMTP_URL, e.g. smtps://user:pass@smtp.example.com:465
// Without it, emails are written to the log instead of being sent (development only).
const transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
if (!transport && isProd) {
  logger.warn('SMTP_URL is not set: verification and password reset emails will NOT be sent.');
}

// Tests read sent emails from here instead of a real inbox.
const outbox = [];

async function sendMail({ to, subject, text, html }) {
  if (env === 'test') {
    outbox.push({ to, subject, text, html });
    return;
  }
  if (!transport) {
    // The body holds a login-equivalent link, so it is logged only outside production.
    if (isProd) {
      logger.error({ event: 'mail_not_sent', subject }, 'SMTP_URL not set, email dropped');
    } else {
      logger.info({ event: 'mail_not_sent', to, subject, text }, 'SMTP_URL not set, email logged instead');
    }
    return;
  }
  await transport.sendMail({ from: MAIL_FROM, to, subject, text, html });
}

module.exports = { sendMail, outbox, APP_URL };
