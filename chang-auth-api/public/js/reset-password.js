const form = document.getElementById('resetForm');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('confirmPassword');
const alertBox = document.getElementById('alert');
const submitBtn = document.getElementById('submitBtn');

// Take the token from the link, then remove it from the address bar so it
// does not stay in browser history.
const token = new URLSearchParams(window.location.search).get('token');
history.replaceState(null, '', '/reset-password');

if (!token) {
  showAlert(alertBox, 'error', 'ลิงก์ไม่ครบ กรุณาเปิดลิงก์จากอีเมลอีกครั้ง หรือขอลิงก์ใหม่');
  submitBtn.disabled = true;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(alertBox);

  const password = passwordInput.value;
  if (password.length < 8) return showAlert(alertBox, 'error', 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  if (password !== confirmInput.value) return showAlert(alertBox, 'error', 'รหัสผ่านทั้งสองช่องไม่ตรงกัน');

  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังบันทึก...';

  const { ok, data } = await api('/reset-password', { method: 'POST', body: { token, password } });

  if (ok) {
    clearToken(); // the old token on this device was revoked too
    window.location.replace('/login?reset=1');
    return;
  }

  showAlert(alertBox, 'error', thai(data.message));
  submitBtn.disabled = false;
  submitBtn.textContent = 'ตั้งรหัสผ่านใหม่';
});
