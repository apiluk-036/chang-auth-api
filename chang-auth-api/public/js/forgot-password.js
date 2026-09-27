const form = document.getElementById('forgotForm');
const emailInput = document.getElementById('email');
const alertBox = document.getElementById('alert');
const submitBtn = document.getElementById('submitBtn');

const presetEmail = new URLSearchParams(window.location.search).get('email');
if (presetEmail) emailInput.value = presetEmail;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(alertBox);

  const email = emailInput.value.trim();
  if (!email) return showAlert(alertBox, 'error', 'กรุณากรอกอีเมล');

  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังส่ง...';

  const { ok, data } = await api('/forgot-password', { method: 'POST', body: { email } });

  // The API answers the same whether or not the email has an account
  showAlert(alertBox, ok ? 'success' : 'error', thai(data.message));
  submitBtn.disabled = false;
  submitBtn.textContent = 'ส่งลิงก์ตั้งรหัสผ่านใหม่';
});
