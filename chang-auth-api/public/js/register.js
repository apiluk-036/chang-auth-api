const form = document.getElementById('registerForm');
const fullNameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('confirmPassword');
const alertBox = document.getElementById('alert');
const submitBtn = document.getElementById('submitBtn');

if (getToken()) window.location.replace('/');

// Came here from login because the email has no account
const params = new URLSearchParams(window.location.search);
const presetEmail = params.get('email');
if (presetEmail) {
  emailInput.value = presetEmail;
  if (params.get('from') === 'login') {
    showAlert(alertBox, 'info', `ไม่พบบัญชีของ ${presetEmail} กรุณาสมัครสมาชิกก่อน`);
  }
  fullNameInput.focus();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(alertBox);

  const fullName = fullNameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email) return showAlert(alertBox, 'error', 'กรุณากรอกอีเมล');
  if (password.length < 8) return showAlert(alertBox, 'error', 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  if (password !== confirmInput.value) return showAlert(alertBox, 'error', 'รหัสผ่านทั้งสองช่องไม่ตรงกัน');

  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังสมัคร...';

  const { ok, status, data } = await api('/register', {
    method: 'POST',
    body: { fullName, email, password },
  });

  if (ok) {
    // Registration returns a token, so log straight in
    setToken(data.token);
    window.location.replace('/');
    return;
  }

  // Email already has an account -> go to login
  if (status === 409 && data.accountExists) {
    window.location.href = `${data.redirectTo || '/login'}?email=${encodeURIComponent(email)}&exists=1`;
    return;
  }

  showAlert(alertBox, 'error', thai(data.message));
  submitBtn.disabled = false;
  submitBtn.textContent = 'สมัครสมาชิก';
});
