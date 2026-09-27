const alertBox = document.getElementById('alert');
const rowsEl = document.getElementById('rows');
const qInput = document.getElementById('q');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageInfo = document.getElementById('pageInfo');

let page = 1;
let q = '';

if (!getToken()) window.location.replace('/login');

function handleAuthError(status) {
  if (status === 401) {
    clearToken();
    window.location.replace('/login?expired=1');
    return true;
  }
  if (status === 403) {
    window.location.replace('/'); // not an admin
    return true;
  }
  return false;
}

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function renderRow(user, roles) {
  const tr = document.createElement('tr');
  tr.append(cell(user.id), cell(user.email), cell(user.fullName || '-'), cell(user.emailVerified ? '✓' : '-'));

  const select = document.createElement('select');
  select.setAttribute('aria-label', `บทบาทของ ${user.email}`);
  for (const role of roles) {
    const opt = document.createElement('option');
    opt.value = role;
    opt.textContent = role;
    opt.selected = role === user.role;
    select.append(opt);
  }
  select.addEventListener('change', async () => {
    const previous = user.role;
    select.disabled = true;
    hideAlert(alertBox);
    const { ok, status, data } = await api(`/users/${user.id}/role`, {
      method: 'PATCH',
      auth: true,
      base: ADMIN_API_BASE,
      body: { role: select.value },
    });
    select.disabled = false;
    if (handleAuthError(status)) return;
    if (ok) {
      user.role = data.user.role;
      showAlert(alertBox, 'success', `เปลี่ยนบทบาทของ ${user.email} เป็น ${user.role} แล้ว`);
    } else {
      select.value = previous;
      showAlert(alertBox, 'error', thai(data.message));
    }
  });

  const td = document.createElement('td');
  td.append(select);
  tr.append(td);
  return tr;
}

async function load() {
  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set('q', q);
  const { ok, status, data } = await api(`/users?${params}`, { auth: true, base: ADMIN_API_BASE });
  if (handleAuthError(status)) return;
  if (!ok) {
    showAlert(alertBox, 'error', thai(data.message));
    return;
  }

  rowsEl.replaceChildren(...data.users.map((u) => renderRow(u, data.roles)));
  if (data.users.length === 0) {
    const tr = document.createElement('tr');
    const td = cell('ไม่พบผู้ใช้');
    td.colSpan = 5;
    tr.append(td);
    rowsEl.append(tr);
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  pageInfo.textContent = `หน้า ${data.page} / ${pages} (${data.total} คน)`;
  prevBtn.disabled = data.page <= 1;
  nextBtn.disabled = data.page >= pages;
}

document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  q = qInput.value.trim();
  page = 1;
  load();
});
prevBtn.addEventListener('click', () => { page -= 1; load(); });
nextBtn.addEventListener('click', () => { page += 1; load(); });

load();
