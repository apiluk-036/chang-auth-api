// Shared helpers for login / register / home pages.
const API_BASE = '/api/auth'; // change to 'http://localhost:4000/api/auth' if the UI is served elsewhere
const TOKEN_KEY = 'token';

// Thai messages for what the API returns
const MESSAGES = {
  'Please provide a valid email address.': 'กรุณากรอกอีเมลให้ถูกต้อง',
  'Password must be at least 8 characters long.': 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
  'Password must be at most 72 characters long.': 'รหัสผ่านต้องไม่เกิน 72 ตัวอักษร',
  'Email and password are required.': 'กรุณากรอกอีเมลและรหัสผ่าน',
  'Incorrect email or password.': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  'Too many attempts. Please try again in 15 minutes.': 'ลองหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่',
};

function thai(message) {
  return MESSAGES[message] || message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
}

async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${getToken()}`;

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, data: { message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' } };
  }

  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, data };
}

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage blocked */ }
}
function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
}

function showAlert(el, type, text) {
  el.className = `alert ${type}`;
  el.textContent = text;
  el.hidden = false;
}
function hideAlert(el) {
  el.hidden = true;
}
