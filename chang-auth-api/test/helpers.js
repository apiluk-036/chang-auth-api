// Loaded first by every test file. Points the app at the TEST database.
//   TEST_DATABASE_URL=mysql://chang_app:password@localhost:3306/chang_test npm test
// Every test file empties the users table, so the database name must contain
// "test" - this refuses to run against a real database by mistake.
require('dotenv').config();

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL) {
  throw new Error('Set TEST_DATABASE_URL (e.g. in .env) to run the tests. See README.');
}
if (!/test/i.test(new URL(TEST_DATABASE_URL).pathname)) {
  throw new Error('TEST_DATABASE_URL database name must contain "test" (tests delete all data).');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-config-jwt-js';
process.env.RATE_LIMIT_IP_MAX = '10000'; // tests make many requests from one IP
process.env.APP_URL = 'http://app.test';

const request = require('supertest');
const app = require('../app');
const pool = require('../config/db');
const migrate = require('../scripts/migrate');
const { outbox } = require('../config/mailer');

async function setupDatabase() {
  await migrate({ log: () => {} });
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE email_tokens');
    await conn.query('TRUNCATE TABLE users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
  outbox.length = 0;
}

let counter = 0;
function uniqueEmail(prefix = 'user') {
  counter += 1;
  return `${prefix}${counter}.${process.pid}@example.com`;
}

async function registerUser({ email = uniqueEmail(), password = 'password123', fullName = 'Test User' } = {}) {
  const res = await request(app).post('/api/auth/register').send({ email, password, fullName });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { email, password, token: res.body.token, user: res.body.user };
}

// Latest email sent to this address, and the token inside its link.
function lastMailTo(email) {
  const mail = [...outbox].reverse().find((m) => m.to === email);
  if (!mail) return null;
  const match = mail.text.match(/token=([a-f0-9]{64})/);
  return { ...mail, token: match && match[1] };
}

module.exports = { request, app, pool, outbox, setupDatabase, uniqueEmail, registerUser, lastMailTo };
