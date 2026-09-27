const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const alertBox = document.getElementById('alert');
const submitBtn = document.getElementById('submitBtn');

// Already logged in -> go home
if (getToken()) window.location.replace('/');

const params = new URLSearchParams(window.location.search);
if (params.get('email')) emailInput.value = params.get('email');
if (params.get('registered') === '1') {
  showAlert(alertBox, 'success', 'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');
}
if (params.get('exists') === '1') {
  showAlert(alertBox, 'info', 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ');
}
if (params.get('expired') === '1') {
  showAlert(alertBox, 'info', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
}
if (params.get('reset') === '1') {
  showAlert(alertBox, 'success', 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสใหม่');
}
if (params.get('loggedOut') === '1') {
  showAlert(alertBox, 'success', 'ออกจากระบบแล้ว (ทุกอุปกรณ์)');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(alertBox);

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    showAlert(alertBox, 'error', 'กรุณากรอกอีเมลและรหัสผ่าน');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังเข้าสู่ระบบ...';

  const { ok, status, data } = await api('/login', {
    method: 'POST',
    body: { email, password },
  });

  if (ok) {
    setToken(data.token);
    window.location.replace('/');
    return;
  }

  // No account with this email -> go to register, carrying the email along
  if (status === 404 && data.accountExists === false) {
    const target = data.redirectTo || '/register';
    window.location.href = `${target}?email=${encodeURIComponent(email)}&from=login`;
    return;
  }

  showAlert(alertBox, 'error', thai(data.message));
  submitBtn.disabled = false;
  submitBtn.textContent = 'เข้าสู่ระบบ';
});

// Keep whatever email was typed when going to forgot-password
document.getElementById('forgotLink').addEventListener('click', (e) => {
  const email = emailInput.value.trim();
  if (email) e.currentTarget.href = `/forgot-password?email=${encodeURIComponent(email)}`;
});

// Keep whatever email was typed when switching to register
document.getElementById('registerLink').addEventListener('click', (e) => {
  const email = emailInput.value.trim();
  if (email) e.currentTarget.href = `/register?email=${encodeURIComponent(email)}`;
});
