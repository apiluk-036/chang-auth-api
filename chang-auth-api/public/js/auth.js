// Shared helpers for every page.
const API_BASE = '/api/auth'; // change to 'http://localhost:4000/api/auth' if the UI is served elsewhere
const ADMIN_API_BASE = API_BASE.replace(/\/auth$/, '/admin');
const TOKEN_KEY = 'token';

// Thai messages for what the API returns
const MESSAGES = {
  'Please provide a valid email address.': 'กรุณากรอกอีเมลให้ถูกต้อง',
  'Password must be at least 8 characters long.': 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
  'Password must be at most 72 characters long.': 'รหัสผ่านต้องไม่เกิน 72 ตัวอักษร',
  'Email and password are required.': 'กรุณากรอกอีเมลและรหัสผ่าน',
  'Incorrect email or password.': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  'Too many attempts. Please try again in 15 minutes.': 'ลองหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่',
  'Too many failed attempts for this email. Please try again in 15 minutes.':
    'ใส่รหัสผ่านของอีเมลนี้ผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่',
  'Too many reset requests for this email. Please try again in 1 hour.':
    'ขอลิงก์ตั้งรหัสใหม่ของอีเมลนี้บ่อยเกินไป กรุณารอ 1 ชั่วโมง',
  'Too many verification emails. Please try again in 1 hour.': 'ส่งอีเมลยืนยันบ่อยเกินไป กรุณารอ 1 ชั่วโมง',
  'If this email has an account, a reset link has been sent.':
    'ถ้าอีเมลนี้มีบัญชีอยู่ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว กรุณาเช็กกล่องอีเมล (รวมถึงโฟลเดอร์สแปม)',
  'This reset link is invalid or has expired.': 'ลิงก์นี้ใช้ไม่ได้ ถูกใช้ไปแล้ว หรือหมดอายุ กรุณาขอลิงก์ใหม่',
  'This verification link is invalid or has expired.': 'ลิงก์ยืนยันอีเมลใช้ไม่ได้ ถูกใช้ไปแล้ว หรือหมดอายุ',
  'Email is already verified.': 'ยืนยันอีเมลแล้ว',
  'Verification email sent.': 'ส่งอีเมลยืนยันแล้ว กรุณาเช็กกล่องอีเมล',
  'Could not send the email. Please try again later.': 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ภายหลัง',
  'Current password is required.': 'กรุณากรอกรหัสผ่านปัจจุบัน',
  'Current password is incorrect.': 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
  'You cannot change your own role.': 'เปลี่ยนบทบาทของตัวเองไม่ได้',
  'You do not have permission to do this.': 'คุณไม่มีสิทธิ์ทำรายการนี้',
  'User not found.': 'ไม่พบผู้ใช้',
};

function thai(message) {
  return MESSAGES[message] || message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
}

// base: API_BASE (default) or ADMIN_API_BASE
async function api(path, { method = 'GET', body, auth = false, base = API_BASE } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${getToken()}`;

  let res;
  try {
    res = await fetch(base + path, {
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
