const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, pool, outbox, setupDatabase, uniqueEmail, registerUser, lastMailTo } = require('./helpers');

before(setupDatabase);
after(() => pool.end());

describe('register / login / me', () => {
  it('registers, returns a token, and sends a verification email', async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', fullName: 'Somchai' });

    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.role, 'user');
    assert.equal(res.body.user.emailVerified, false);
    assert.equal(res.body.verificationEmailSent, true);

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE email = ?', [email]);
    assert.notEqual(rows[0].password_hash, 'password123');
    assert.match(lastMailTo(email).text, /http:\/\/app\.test\/verify-email\?token=/);
  });

  it('ignores a role sent by the client', async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', role: 'admin' });
    assert.equal(res.body.user.role, 'user');
  });

  it('rejects a short password and a bad email', async () => {
    const short = await request(app).post('/api/auth/register').send({ email: uniqueEmail(), password: '123' });
    assert.equal(short.status, 400);
    const bad = await request(app).post('/api/auth/register').send({ email: 'nope', password: 'password123' });
    assert.equal(bad.status, 400);
  });

  it('answers 409 with redirectTo /login for an existing email', async () => {
    const { email } = await registerUser();
    const res = await request(app).post('/api/auth/register').send({ email: email.toUpperCase(), password: 'password123' });
    assert.equal(res.status, 409);
    assert.equal(res.body.redirectTo, '/login');
  });

  it('login: 404 unknown email, 401 wrong password, 200 correct', async () => {
    const { email, password } = await registerUser();

    const unknown = await request(app).post('/api/auth/login').send({ email: uniqueEmail(), password });
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.redirectTo, '/register');

    const wrong = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
    assert.equal(wrong.status, 401);

    const ok = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
  });

  it('me: 401 without a token, 200 with one', async () => {
    const { token, email } = await registerUser();
    assert.equal((await request(app).get('/api/auth/me')).status, 401);

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, email);
  });

  it('unknown /api route is JSON 404', async () => {
    const res = await request(app).get('/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Not found.');
  });

  it('adds X-Request-Id to responses', async () => {
    const res = await request(app).get('/api/health').set('X-Request-Id', 'abc-123');
    assert.equal(res.headers['x-request-id'], 'abc-123');
  });
});

describe('email verification', () => {
  it('verifies with the emailed token, once', async () => {
    const { email, token } = await registerUser();
    const verifyToken = lastMailTo(email).token;

    const res = await request(app).post('/api/auth/verify-email').send({ token: verifyToken });
    assert.equal(res.status, 200);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    assert.equal(me.body.user.emailVerified, true);

    const again = await request(app).post('/api/auth/verify-email').send({ token: verifyToken });
    assert.equal(again.status, 400);
  });

  it('rejects an expired token', async () => {
    const { email } = await registerUser();
    const verifyToken = lastMailTo(email).token;
    await pool.query(
      "UPDATE email_tokens SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE purpose = 'verify_email'"
    );
    const res = await request(app).post('/api/auth/verify-email').send({ token: verifyToken });
    assert.equal(res.status, 400);
  });

  it('resend sends a new link and the old one stops working', async () => {
    const { email, token } = await registerUser();
    const oldToken = lastMailTo(email).token;

    const res = await request(app).post('/api/auth/resend-verification').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    const newToken = lastMailTo(email).token;
    assert.notEqual(newToken, oldToken);

    assert.equal((await request(app).post('/api/auth/verify-email').send({ token: oldToken })).status, 400);
    assert.equal((await request(app).post('/api/auth/verify-email').send({ token: newToken })).status, 200);

    const done = await request(app).post('/api/auth/resend-verification').set('Authorization', `Bearer ${token}`);
    assert.equal(done.status, 400);
  });
});

describe('token revocation', () => {
  it('logout makes every existing token stop working', async () => {
    const { email, password, token } = await registerUser();
    const second = await request(app).post('/api/auth/login').send({ email, password }); // "another device"

    const res = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);

    for (const t of [token, second.body.token]) {
      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${t}`);
      assert.equal(me.status, 401);
    }

    const again = await request(app).post('/api/auth/login').send({ email, password });
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${again.body.token}`);
    assert.equal(me.status, 200);
  });

  it('change-password revokes old tokens and returns a working new one', async () => {
    const { email, password, token } = await registerUser();

    const wrong = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'not-it', newPassword: 'newpassword1' });
    assert.equal(wrong.status, 401);

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: 'newpassword1' });
    assert.equal(res.status, 200);

    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status, 401);
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`)).status, 200);

    assert.equal((await request(app).post('/api/auth/login').send({ email, password })).status, 401);
    assert.equal((await request(app).post('/api/auth/login').send({ email, password: 'newpassword1' })).status, 200);
  });
});

describe('forgot / reset password', () => {
  it('gives the same answer for unknown emails and sends nothing', async () => {
    const email = uniqueEmail();
    const before = outbox.length;
    const res = await request(app).post('/api/auth/forgot-password').send({ email });
    assert.equal(res.status, 200);
    assert.equal(outbox.length, before);
  });

  it('resets the password with the emailed token, once, and logs out old sessions', async () => {
    const { email, password, token } = await registerUser();

    const res = await request(app).post('/api/auth/forgot-password').send({ email });
    assert.equal(res.status, 200);
    const mail = lastMailTo(email);
    assert.match(mail.text, /http:\/\/app\.test\/reset-password\?token=/);

    const short = await request(app).post('/api/auth/reset-password').send({ token: mail.token, password: '123' });
    assert.equal(short.status, 400);

    const reset = await request(app).post('/api/auth/reset-password').send({ token: mail.token, password: 'brandnew123' });
    assert.equal(reset.status, 200);

    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status, 401);
    assert.equal((await request(app).post('/api/auth/login').send({ email, password })).status, 401);
    assert.equal((await request(app).post('/api/auth/login').send({ email, password: 'brandnew123' })).status, 200);

    const reuse = await request(app).post('/api/auth/reset-password').send({ token: mail.token, password: 'another123' });
    assert.equal(reuse.status, 400);
  });

  it('rejects an expired reset token', async () => {
    const { email } = await registerUser();
    await request(app).post('/api/auth/forgot-password').send({ email });
    const { token } = lastMailTo(email);
    await pool.query(
      "UPDATE email_tokens SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE purpose = 'reset_password'"
    );
    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'brandnew123' });
    assert.equal(res.status, 400);
  });
});

describe('per-email rate limit', () => {
  it('blocks an email after 5 failed logins, other emails still work', async () => {
    const { email, password } = await registerUser();
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
      assert.equal(res.status, 401);
    }
    // Even the right password is refused now, from any IP
    const blocked = await request(app).post('/api/auth/login').send({ email: email.toUpperCase(), password });
    assert.equal(blocked.status, 429);

    const other = await registerUser();
    const ok = await request(app).post('/api/auth/login').send({ email: other.email, password: other.password });
    assert.equal(ok.status, 200);
  });

  it('successful logins do not count', async () => {
    const { email, password } = await registerUser();
    for (let i = 0; i < 7; i++) {
      const res = await request(app).post('/api/auth/login').send({ email, password });
      assert.equal(res.status, 200);
    }
  });

  it('allows 3 forgot-password requests per email per hour', async () => {
    const { email } = await registerUser();
    for (let i = 0; i < 3; i++) {
      assert.equal((await request(app).post('/api/auth/forgot-password').send({ email })).status, 200);
    }
    assert.equal((await request(app).post('/api/auth/forgot-password').send({ email })).status, 429);
  });
});
