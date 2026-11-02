// Keep the browser URL clean when visitors arrive through campaign links.
(function removeTrackingQueryParameters() {
  const url = new URL(window.location.href);
  const parameters = [...url.searchParams.keys()].filter(key => /^utm_/i.test(key));
  if (!parameters.length) return;
  for (const key of parameters) url.searchParams.delete(key);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
})();

const $ = sel => document.querySelector(sel);
const currency = amount => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
const STATUS = { serviceId: '', date: '' };
const errorMessage = $('#form-message');

function vnToday(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).filter(p => ['year','month','day'].includes(p.type)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Có lỗi kết nối. Vui lòng thử lại.');
  return data;
}
function showMessage(message, isError = false) {
  errorMessage.textContent = message;
  errorMessage.classList.toggle('error', isError);
}
function createServiceCard(service, index) {
  const card = document.createElement('article');
  card.className = `service-card service-card-${index + 1}`;
  const art = document.createElement('div'); art.className = 'service-art';
  const symbol = document.createElement('span'); symbol.className = 'service-art-symbol';
  symbol.textContent = ['✳', '☘', '❋'][index % 3];
  art.appendChild(symbol);
  const tag = document.createElement('div'); tag.className = 'service-count'; tag.textContent = `GÓI 0${index+1}`;
  const h3 = document.createElement('h3'); h3.textContent = service.name;
  const desc = document.createElement('p'); desc.textContent = service.description;
  const row = document.createElement('div'); row.className = 'service-meta';
  const duration = document.createElement('span'); duration.textContent = `◷ ${service.duration} phút`;
  const price = document.createElement('strong'); price.textContent = currency(service.price);
  row.append(duration, price);
  const link = document.createElement('button'); link.type = 'button'; link.className = 'service-choose';
  link.textContent = 'Chọn dịch vụ ↗';
  link.addEventListener('click', () => { $('#service-input').value = service.id; $('#booking').scrollIntoView({ behavior: 'smooth' }); });
  card.append(art, tag, h3, desc, row, link);
  return card;
}
async function loadServices() {
  const { services } = await request('/api/services');
  const grid = $('#service-grid'); grid.replaceChildren();
  const select = $('#service-input');
  for (const [index, service] of services.entries()) {
    grid.append(createServiceCard(service, index));
    const option = document.createElement('option'); option.value = service.id; option.textContent = `${service.name} · ${currency(service.price)}`; select.append(option);
  }
}
async function loadAvailability() {
  const date = $('#date-input').value;
  const select = $('#time-input');
  const defaultOption = document.createElement('option'); defaultOption.value = '';
  if (!date) { defaultOption.textContent = 'Chọn ngày trước'; select.replaceChildren(defaultOption); select.disabled = true; return; }
  defaultOption.textContent = 'Đang tải khung giờ...'; select.replaceChildren(defaultOption); select.disabled = true;
  try {
    const { slots } = await request(`/api/availability?date=${encodeURIComponent(date)}`);
    if ($('#date-input').value !== date) return;
    defaultOption.textContent = 'Chọn khung giờ'; select.replaceChildren(defaultOption);
    for (const slot of slots) {
      const option = document.createElement('option'); option.value = slot.time;
      option.textContent = slot.available ? slot.time : `${slot.time} · Đã có lịch`;
      option.disabled = !slot.available; select.append(option);
    }
    select.disabled = false;
    if (!slots.some(slot => slot.available)) showMessage('Ngày này đã hết khung giờ. Hãy chọn ngày khác.', true);
    else showMessage('');
  } catch (err) { defaultOption.textContent = 'Không tải được khung giờ'; select.replaceChildren(defaultOption); showMessage(err.message, true); }
}
async function onSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  if (!body.serviceId || !body.date || !body.time || !body.name.trim() || !body.phone.trim()) {
    showMessage('Vui lòng điền đủ các trường bắt buộc.', true); return;
  }
  if (!/^(?:\+84|0)[0-9]{9,10}$/.test(body.phone.replace(/[.\s-]/g, ''))) {
    showMessage('Số điện thoại chưa đúng định dạng.', true); return;
  }
  const button = $('#submit-button'); button.disabled = true; button.textContent = 'Đang gửi yêu cầu...';
  showMessage('');
  try {
    const data = await request('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    form.hidden = true;
    $('#booking-success').hidden = false;
    $('#success-details').textContent = `Mã lịch #${data.booking.id} · ${data.booking.time} ngày ${new Date(`${data.booking.date}T00:00:00`).toLocaleDateString('vi-VN')}.`;
  } catch (err) { showMessage(err.message, true); await loadAvailability(); }
  finally { button.disabled = false; button.textContent = 'Gửi yêu cầu đặt lịch ↗'; }
}
function start() {
  $('#date-input').min = vnToday(); $('#date-input').max = vnToday(60);
  $('#date-input').addEventListener('change', loadAvailability);
  $('#booking-form').addEventListener('submit', onSubmit);
  $('#book-again').addEventListener('click', () => {
    $('#booking-success').hidden = true; $('#booking-form').hidden = false;
    $('#booking-form').reset(); showMessage(''); loadAvailability();
  });
  loadServices().catch(err => {
    $('#service-grid').textContent = `Không thể tải danh sách dịch vụ: ${err.message}`;
    showMessage('Không thể tải dịch vụ. Hãy kiểm tra kết nối.', true);
  });
}
start();
