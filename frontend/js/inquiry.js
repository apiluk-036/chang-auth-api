import { api, currentUser } from './api.js';
import { escapeHtml, loadSettings } from './common.js';

/* ============================================================
   หน้าแรก — ฟอร์ม Send us Your Question → POST /api/inquiries
   หา element จากโครงสร้างของ section #contact เอง จึงไม่ต้องแก้ HTML ของหน้าแรก
   ============================================================ */
function initInquiryForm() {
  const section = document.getElementById('contact');
  const contactInput = section?.querySelector('input[type="text"]');
  const messageInput = section?.querySelector('textarea');
  const submit = messageInput?.parentElement.querySelector('button');
  if (!contactInput || !messageInput || !submit) return;

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  submit.after(status);

  const setStatus = (text, ok) => {
    status.textContent = text;
    status.className = `text-sm font-semibold ${ok ? 'text-forest' : 'text-red-600'}`;
  };

  submit.addEventListener('click', async (event) => {
    event.preventDefault();

    const contact = contactInput.value.trim();
    const message = messageInput.value.trim();

    if (!contact || !message) {
      setStatus('กรุณากรอกช่องทางติดต่อและคำถามให้ครบ', false);
      return;
    }

    submit.disabled = true;
    submit.classList.add('opacity-60');
    setStatus('กำลังส่ง...', true);

    try {
      const result = await api.sendInquiry({ contact, message });
      setStatus(result.message, true);
      contactInput.value = '';
      messageInput.value = '';
    } catch (error) {
      setStatus(error.message, false);
    } finally {
      submit.disabled = false;
      submit.classList.remove('opacity-60');
    }
  });
}

/* เติมค่าตั้งระบบจากหลังบ้าน (เช่น เวลาเปิดทำการ) ลงใน element ที่มี data-setting
   ไม่ใช้ initSite() ของ common.js เพราะเมนูมือถือของหน้านี้ผูกไว้ใน script.js แล้ว */
async function applySettings() {
  const settings = await loadSettings();
  for (const element of document.querySelectorAll('[data-setting]')) {
    const value = settings[element.dataset.setting];
    if (value !== undefined && value !== '') element.textContent = value;
  }
}

/* ลิงก์บัญชีบน navbar ของหน้าแรก — หน้านี้เป็นภาษาอังกฤษทั้งหน้า จึงไม่ใช้ renderAuthNav() ของ common.js
   ที่เป็นข้อความไทยสำหรับหน้าย่อย ขนาดตัวอักษรและระยะห่างรับมาจาก container ให้เท่ากับเมนูหลัก */
function renderHomeAuthNav() {
  const user = currentUser.get();
  const linkClass = 'hover:text-forest transition whitespace-nowrap';
  const html = user
    ? `<a href="account.html" class="${linkClass}">${escapeHtml(user.first_name)}</a>`
    : `<a href="booking.html" class="${linkClass}">My Booking</a>
       <a href="login.html" class="${linkClass}">Log in</a>`;

  for (const slot of document.querySelectorAll('[data-auth-nav]')) slot.innerHTML = html;
}

// module script ถูก defer อยู่แล้ว ตอนรันถึงตรงนี้ DOM พร้อมใช้งาน
renderHomeAuthNav();
applySettings();
initInquiryForm();
