const $ = sel => document.querySelector(sel);
const label = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
let bookings = [];
const number = value => Number(value).toLocaleString('vi-VN');

async function request(path, options = undefined) {
  const resp = await fetch(path, { credentials: 'same-origin', ...options });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || 'Có lỗi xảy ra.');
  return body;
}
function setMessage(text, error = false, selector = '#dashboard-message') {
  const node = $(selector); node.textContent = text; node.classList.toggle('error', error);
}
function element(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function statusTag(status) { return element('span', `status-tag status-${status}`, label[status] || status); }
function actionButton(text, status, id, variant = '') {
  const button = element('button', `table-action ${variant}`, text);
  button.type = 'button'; button.addEventListener('click', () => updateStatus(id, status));
  return button;
}
function makeRow(b) {
  const tr = document.createElement('tr');
  const id = element('td', 'booking-id', `#${String(b.id).padStart(4, '0')}`);
  const customer = element('td', '');
  const name = element('strong', 'table-name', b.name);
  const phone = element('small', 'table-secondary', b.phone);
  customer.append(name, phone);
  const service = element('td', '', b.serviceName);
  const date = element('td', '');
  date.append(element('strong', 'table-name', `${b.time} · ${b.date.split('-').reverse().join('/')}`));
  const state = document.createElement('td'); state.append(statusTag(b.status));
  const actions = element('td', 'action-cell');
  if (b.status === 'pending') { actions.append(actionButton('Xác nhận', 'confirmed', b.id), actionButton('Hủy', 'cancelled', b.id, 'muted')); }
  else if (b.status === 'confirmed') { actions.append(actionButton('Hoàn thành', 'completed', b.id), actionButton('Hủy', 'cancelled', b.id, 'muted')); }
  else { actions.append(element('span', 'table-secondary', '—')); }
  tr.append(id, customer, service, date, state, actions);
  return tr;
}
function render() {
  const counts = { total: bookings.length, pending: 0, confirmed: 0, completed: 0 };
  for (const item of bookings) if (counts[item.status] !== undefined) counts[item.status]++;
  for (const [key, value] of Object.entries(counts)) $(`#stat-${key}`).textContent = number(value);
  const query = $('#search-bookings').value.trim().toLocaleLowerCase('vi-VN');
  const selected = $('#filter-status').value;
  const filtered = bookings.filter(b => (selected === 'all' || b.status === selected)
    && (!query || `${b.name} ${b.phone} ${b.serviceName} ${b.id}`.toLocaleLowerCase('vi-VN').includes(query)));
  $('#result-count').textContent = number(filtered.length);
  const tbody = $('#booking-rows'); tbody.replaceChildren();
  if (!filtered.length) {
    const tr = document.createElement('tr'); const td = element('td', 'empty-row', 'Chưa có lịch hẹn phù hợp. Hãy đặt một lịch ở trang chủ để thử nghiệm.');
    td.colSpan = 6; tr.append(td); tbody.append(tr);
  } else for (const booking of filtered) tbody.append(makeRow(booking));
  $('#table-footer-text').textContent = `Hiển thị ${filtered.length} / ${bookings.length} lịch hẹn`;
}
async function loadBookings() {
  try { const data = await request('/api/admin/bookings'); bookings = data.bookings; render(); setMessage(''); }
  catch (err) { if (err.message.includes('đăng nhập')) showLogin(); else setMessage(err.message, true); }
}
async function updateStatus(id, status) {
  const messages = { confirmed: 'Xác nhận lịch hẹn này?', completed: 'Đánh dấu lịch này là hoàn thành?', cancelled: 'Bạn có chắc muốn hủy lịch hẹn này?' };
  if (!window.confirm(messages[status])) return;
  try {
    await request(`/api/admin/bookings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    await loadBookings(); setMessage('Đã cập nhật trạng thái lịch hẹn.');
  } catch (err) { setMessage(err.message, true); }
}
function showLogin() { $('#login-screen').hidden = false; $('#dashboard-screen').hidden = true; }
function showDashboard() { $('#login-screen').hidden = true; $('#dashboard-screen').hidden = false; loadBookings(); }
async function init() {
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('#login-button'); button.disabled = true; button.textContent = 'Đang xác thực...';
    try {
      await request('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#admin-password').value }) });
      $('#admin-password').value = ''; setMessage('', false, '#login-message'); showDashboard();
    } catch (err) { setMessage(err.message, true, '#login-message'); }
    finally { button.disabled = false; button.textContent = 'Đăng nhập ↗'; }
  });
  $('#logout-button').addEventListener('click', async () => {
    try { await request('/api/admin/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); }
    finally { showLogin(); }
  });
  $('#search-bookings').addEventListener('input', render);
  $('#filter-status').addEventListener('change', render);
  $('#refresh-button').addEventListener('click', loadBookings);
  try { const { authenticated } = await request('/api/admin/me'); authenticated ? showDashboard() : showLogin(); }
  catch { showLogin(); }
}
init();
