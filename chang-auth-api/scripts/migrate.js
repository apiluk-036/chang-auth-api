// Applies every migrations/NNN_name.sql that has not run yet, in order.
//   npm run migrate
// Applied files are recorded in the schema_migrations table. Never edit a file
// that has already run somewhere: add a new numbered file instead.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getDbOptions } = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const LOCK_NAME = 'chang_auth_api_migrate';

async function migrate({ log = console.log } = {}) {
  const conn = await mysql.createConnection({ ...getDbOptions(), multipleStatements: true });
  try {
    // Two servers starting at once must not run the same migration twice.
    const [[{ locked }]] = await conn.query('SELECT GET_LOCK(?, 30) AS locked', [LOCK_NAME]);
    if (locked !== 1) throw new Error('Could not get the migration lock (another migration running?).');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`);

    const [rows] = await conn.query('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d+_.+\.sql$/.test(f))
      .sort();

    const applied = [];
    for (const file of files) {
      if (done.has(file)) continue;
      // MySQL commits DDL immediately, so a file that fails half-way is not
      // rolled back. Keep each file small and fix forward with a new file.
      await conn.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      applied.push(file);
      log(`applied ${file}`);
    }
    if (applied.length === 0) log('database is up to date');
    return applied;
  } finally {
    await conn.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]).catch(() => {});
    await conn.end();
  }
}

module.exports = migrate;

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}
