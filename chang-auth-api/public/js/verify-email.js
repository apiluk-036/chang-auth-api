(async () => {
  const statusText = document.getElementById('status');
  const alertBox = document.getElementById('alert');
  const nextLink = document.getElementById('nextLink');

  const token = new URLSearchParams(window.location.search).get('token');
  history.replaceState(null, '', '/verify-email');

  if (!getToken()) {
    nextLink.href = '/login';
    nextLink.textContent = 'ไปหน้าเข้าสู่ระบบ';
  }

  if (!token) {
    statusText.textContent = '';
    showAlert(alertBox, 'error', 'ลิงก์ไม่ครบ กรุณาเปิดลิงก์จากอีเมลอีกครั้ง');
    return;
  }

  // Done with a POST from this page (not by just opening the link), so email
  // scanners that pre-open links do not use up the token.
  const { ok, data } = await api('/verify-email', { method: 'POST', body: { token } });
  statusText.textContent = '';
  if (ok) {
    showAlert(alertBox, 'success', 'ยืนยันอีเมลเรียบร้อยแล้ว');
  } else {
    showAlert(alertBox, 'error', `${thai(data.message)} (ขอลิงก์ใหม่ได้ที่หน้าหลักหลังเข้าสู่ระบบ)`);
  }
})();
