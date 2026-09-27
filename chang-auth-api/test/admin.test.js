const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, pool, setupDatabase, registerUser } = require('./helpers');

let admin;
let user;

before(async () => {
  await setupDatabase();
  admin = await registerUser({ fullName: 'Admin' });
  await pool.query("UPDATE users SET role = 'admin' WHERE id = ?", [admin.user.id]);
  user = await registerUser({ fullName: 'Normal User' });
});
after(() => pool.end());

const as = (who) => ({ Authorization: `Bearer ${who.token}` });

describe('admin API', () => {
  it('needs a login and the admin role', async () => {
    assert.equal((await request(app).get('/api/admin/users')).status, 401);
    assert.equal((await request(app).get('/api/admin/users').set(as(user))).status, 403);
  });

  it('lists and searches users', async () => {
    const all = await request(app).get('/api/admin/users').set(as(admin));
    assert.equal(all.status, 200);
    assert.equal(all.body.total, 2);
    assert.deepEqual(all.body.roles, ['user', 'staff', 'agency', 'admin']);

    const found = await request(app).get('/api/admin/users').query({ q: 'Normal' }).set(as(admin));
    assert.equal(found.body.total, 1);
    assert.equal(found.body.users[0].email, user.email);

    // "%" is matched literally, not as a wildcard
    const literal = await request(app).get('/api/admin/users').query({ q: '%' }).set(as(admin));
    assert.equal(literal.body.total, 0);
  });

  it('changes a role, and it applies to the user immediately', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${user.user.id}/role`)
      .set(as(admin))
      .send({ role: 'staff' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'staff');

    // Same token as before, new role
    const me = await request(app).get('/api/auth/me').set(as(user));
    assert.equal(me.body.user.role, 'staff');
  });

  it('rejects bad roles, unknown users and changing your own role', async () => {
    const bad = await request(app).patch(`/api/admin/users/${user.user.id}/role`).set(as(admin)).send({ role: 'root' });
    assert.equal(bad.status, 400);

    const missing = await request(app).patch('/api/admin/users/999999/role').set(as(admin)).send({ role: 'staff' });
    assert.equal(missing.status, 404);

    const self = await request(app).patch(`/api/admin/users/${admin.user.id}/role`).set(as(admin)).send({ role: 'user' });
    assert.equal(self.status, 400);
  });

  it('an admin demoted by another admin loses access at once', async () => {
    const second = await registerUser();
    await pool.query("UPDATE users SET role = 'admin' WHERE id = ?", [second.user.id]);
    assert.equal((await request(app).get('/api/admin/users').set(as(second))).status, 200);

    await request(app).patch(`/api/admin/users/${second.user.id}/role`).set(as(admin)).send({ role: 'user' });
    assert.equal((await request(app).get('/api/admin/users').set(as(second))).status, 403);
  });
});
