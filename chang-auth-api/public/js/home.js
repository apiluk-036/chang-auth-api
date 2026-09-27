(async () => {
  // Not logged in -> login page
  if (!getToken()) {
    window.location.replace('/login');
    return;
  }

  const { ok, status, data } = await api('/me', { auth: true });
  if (!ok) {
    if (status === 401) {
      clearToken();
      window.location.replace('/login?expired=1');
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
})();

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearToken();
  window.location.replace('/login');
});
