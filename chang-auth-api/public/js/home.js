const alertBox = document.getElementById('alert');

function sessionEnded() {
  clearToken();
  window.location.replace('/login?expired=1');
}

(async () => {
  // Not logged in -> login page
  if (!getToken()) {
    window.location.replace('/login');
    return;
  }

  const { ok, status, data } = await api('/me', { auth: true });
  if (!ok) {
    if (status === 401) {
      sessionEnded();
    } else {
      document.getElementById('greeting').textContent = thai(data.message);
    }
    return;
  }

  const u = data.user;
  document.getElementById('greeting').textContent = `สวัสดี ${u.fullName || u.email}`;
  document.getElementById('email').textContent = u.email;
  document.getElementById('fullName').textContent = u.fullName || '-';
  document.getElementById('role').textContent = u.role;
  document.getElementById('verified').textContent = u.emailVerified ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน';
  document.getElementById('verifyBanner').hidden = u.emailVerified;
  document.getElementById('adminLink').hidden = u.role !== 'admin';
})();

document.getElementById('resendBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  const { ok, status, data } = await api('/resend-verification', { method: 'POST', auth: true });
  if (status === 401) return sessionEnded();
  showAlert(alertBox, ok ? 'success' : 'error', thai(data.message));
  btn.disabled = false;
});

document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(alertBox);
  const btn = document.getElementById('changePasswordBtn');
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;

  if (newPassword.length < 8) return showAlert(alertBox, 'error', 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');

  btn.disabled = true;
  const { ok, status, data } = await api('/change-password', {
    method: 'POST',
    auth: true,
    body: { currentPassword, newPassword },
  });
  btn.disabled = false;

  if (ok) {
    setToken(data.token); // old token was revoked; keep this device logged in
    e.target.reset();
    showAlert(alertBox, 'success', 'เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นถูกออกจากระบบ');
    return;
  }
  // 401 here can also mean "current password is incorrect"
  if (status === 401 && data.message !== 'Current password is incorrect.') return sessionEnded();
  showAlert(alertBox, 'error', thai(data.message));
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  // Revoke the token on the server (all devices), then forget it here.
  // Clear locally even if the request fails, so the user is never stuck logged in.
  await api('/logout', { method: 'POST', auth: true });
  clearToken();
  window.location.replace('/login?loggedOut=1');
});
