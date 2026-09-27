const { sendMail, APP_URL } = require('../config/mailer');
const { createEmailToken } = require('./tokenService');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function linkEmail({ greetingName, intro, link, buttonText, outro }) {
  const name = greetingName || 'ผู้ใช้';
  const text = `สวัสดีคุณ ${name}\n\n${intro}\n\n${link}\n\n${outro}`;
  const html = `
    <p>สวัสดีคุณ ${escapeHtml(name)}</p>
    <p>${escapeHtml(intro)}</p>
    <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;background:#2f6fed;color:#fff;border-radius:6px;text-decoration:none">${escapeHtml(buttonText)}</a></p>
    <p style="color:#656d76;font-size:13px">ถ้ากดปุ่มไม่ได้ ให้คัดลอกลิงก์นี้ไปเปิด: ${escapeHtml(link)}</p>
    <p style="color:#656d76;font-size:13px">${escapeHtml(outro)}</p>`;
  return { text, html };
}

async function sendVerificationEmail(user) {
  const token = await createEmailToken(user.id, 'verify_email');
  const link = `${APP_URL}/verify-email?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'ยืนยันอีเมลของคุณ',
    ...linkEmail({
      greetingName: user.full_name,
      intro: 'กรุณากดลิงก์ด้านล่างเพื่อยืนยันอีเมล (ลิงก์ใช้ได้ 24 ชั่วโมง)',
      link,
      buttonText: 'ยืนยันอีเมล',
      outro: 'ถ้าคุณไม่ได้สมัครสมาชิก ไม่ต้องทำอะไร',
    }),
  });
}

async function sendPasswordResetEmail(user) {
  const token = await createEmailToken(user.id, 'reset_password');
  const link = `${APP_URL}/reset-password?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'ตั้งรหัสผ่านใหม่',
    ...linkEmail({
      greetingName: user.full_name,
      intro: 'มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ กดลิงก์ด้านล่างเพื่อตั้งรหัสใหม่ (ลิงก์ใช้ได้ 1 ชั่วโมง ใช้ได้ครั้งเดียว)',
      link,
      buttonText: 'ตั้งรหัสผ่านใหม่',
      outro: 'ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ',
    }),
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
