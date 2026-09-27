// Gives an existing account the admin role, so it can open /admin.
//   npm run make-admin -- someone@example.com
// Use this once for the first admin; after that, admins change roles on /admin.
require('dotenv').config();
const pool = require('../config/db');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run make-admin -- <email>');
    process.exit(1);
  }
  const [result] = await pool.query("UPDATE users SET role = 'admin' WHERE email = ?", [email]);
  if (result.affectedRows === 0) {
    console.error(`No account with email ${email}. Register it first.`);
    process.exit(1);
  }
  console.log(`${email} is now an admin.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
