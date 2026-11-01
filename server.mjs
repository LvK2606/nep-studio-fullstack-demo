import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { openDatabase, listServices, TIME_SLOTS, bookedSlots, createBooking, listBookings, getBooking, changeBookingStatus, STATUSES } from './src/db.mjs';
import { newSessionCookie, clearSessionCookie, isLoggedIn, verifyLogin, sameOrigin } from './src/security.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
process.chdir(ROOT);
if (existsSync('.env') && typeof process.loadEnvFile === 'function') process.loadEnvFile('.env');
if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12 || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 48) {
  console.error('Chưa có cấu hình bảo mật. Chạy "npm run setup" rồi "npm start".');
  process.exit(1);
}
const db = openDatabase();
const PORT = Number(process.env.PORT ?? 3000);

const STATIC = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/admin', ['public/admin.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['public/styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']],
  ['/admin.js', ['public/admin.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['public/favicon.svg', 'image/svg+xml']]
]);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
  'Cache-Control': 'no-store'
};

function json(res, status, data, headers={}) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data));
}
function fail(res, status, message) { json(res, status, { error: message }); }
function vietnamClock() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).filter(item => ['year','month','day','hour','minute'].includes(item.type))
    .map(item => [item.type, item.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
function futureSlot(date, time) {
  const now = vietnamClock();
  return date > now.date || (date === now.date && time > now.time);
}
function validDate(input) {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const d = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== input) return false;
  const diff = (Date.parse(input) - Date.parse(vietnamClock().date)) / 86400000;
  return diff >= 0 && diff <= 60;
}
async function getBody(req) {
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    throw Object.assign(new Error('Dữ liệu phải ở định dạng JSON.'), { status: 415 });
  }
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16_384) throw Object.assign(new Error('Nội dung quá dài.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON không hợp lệ.'), { status: 400 }); }
}
function validateBooking(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Thông tin đặt lịch không hợp lệ.';
  const { serviceId, name, phone, date, time, note } = raw;
  if (typeof serviceId !== 'string' || !db.prepare('SELECT id FROM services WHERE id=?').get(serviceId)) return 'Vui lòng chọn dịch vụ hợp lệ.';
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return 'Họ tên phải từ 2 đến 80 ký tự.';
  if (typeof phone !== 'string' || !/^(?:\+84|0)[0-9]{9,10}$/.test(phone.replace(/[.\s-]/g, ''))) return 'Số điện thoại Việt Nam không hợp lệ.';
  if (!validDate(date)) return 'Chỉ đặt lịch trong 60 ngày tới.';
  if (!TIME_SLOTS.includes(time)) return 'Giờ hẹn không hợp lệ.';
  if (typeof note !== 'string' || note.length > 500) return 'Ghi chú tối đa 500 ký tự.';
  return null;
}
function isConstraintError(error) {
  return error?.code?.includes('SQLITE_CONSTRAINT') || String(error?.message).includes('UNIQUE constraint failed');
}

const server = createServer(async (req, res) => {
  try {
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; }
    catch { return fail(res, 400, 'Đường dẫn không hợp lệ.'); }
    if (req.method === 'GET' && STATIC.has(pathname)) {
      const [file, type] = STATIC.get(pathname);
      const body = readFileSync(resolve(ROOT, file));
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': type });
      return res.end(body);
    }
    if (!pathname.startsWith('/api/')) return fail(res, 404, 'Không tìm thấy trang.');
    if (!['GET', 'POST', 'PATCH'].includes(req.method)) return fail(res, 405, 'Phương thức không được hỗ trợ.');
    if (req.method !== 'GET' && !sameOrigin(req)) return fail(res, 403, 'Yêu cầu khác nguồn bị từ chối.');

    if (req.method === 'GET' && pathname === '/api/services') return json(res, 200, { services: listServices(db) });
    if (req.method === 'GET' && pathname === '/api/availability') {
      const date = new URL(req.url, 'http://localhost').searchParams.get('date');
      if (!validDate(date)) return fail(res, 400, 'Ngày không hợp lệ hoặc ngoài khoảng 60 ngày.');
      const taken = new Set(bookedSlots(db, date));
      return json(res, 200, { date, slots: TIME_SLOTS.map(time => ({ time, available: !taken.has(time) && futureSlot(date, time) })) });
    }
    if (req.method === 'POST' && pathname === '/api/bookings') {
      const body = await getBody(req);
      const error = validateBooking(body);
      if (error) return fail(res, 400, error);
      if (!futureSlot(body.date, body.time)) return fail(res, 400, 'Không thể đặt khung giờ đã qua.');
      try {
        const id = createBooking(db, {
          serviceId: body.serviceId, name: body.name.trim(), phone: body.phone.replace(/[.\s-]/g, ''),
          date: body.date, time: body.time, note: body.note.trim()
        });
        return json(res, 201, { message: 'Đã nhận yêu cầu đặt lịch.', booking: { id, date: body.date, time: body.time, status: 'pending' } });
      } catch (err) {
        if (isConstraintError(err)) return fail(res, 409, 'Khung giờ này vừa được đặt. Vui lòng chọn giờ khác.');
        throw err;
      }
    }
    if (req.method === 'POST' && pathname === '/api/admin/login') {
      const body = await getBody(req);
      const result = verifyLogin(req, typeof body?.password === 'string' ? body.password : '');
      if (result.limited) return fail(res, 429, 'Đã thử quá nhiều lần. Hãy quay lại sau 15 phút.');
      if (!result.ok) return fail(res, 401, 'Mật khẩu không đúng.');
      return json(res, 200, { ok: true }, { 'Set-Cookie': newSessionCookie(req) });
    }
    if (req.method === 'GET' && pathname === '/api/admin/me') return json(res, 200, { authenticated: isLoggedIn(req) });
    if (req.method === 'POST' && pathname === '/api/admin/logout')
      return json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie() });
    if (pathname.startsWith('/api/admin/') && !isLoggedIn(req)) return fail(res, 401, 'Vui lòng đăng nhập quản trị.');
    if (req.method === 'GET' && pathname === '/api/admin/bookings') return json(res, 200, { bookings: listBookings(db) });
    const match = pathname.match(/^\/api\/admin\/bookings\/(\d+)$/);
    if (req.method === 'PATCH' && match) {
      const id = Number(match[1]);
      if (!Number.isSafeInteger(id) || id < 1) return fail(res, 400, 'ID không hợp lệ.');
      const body = await getBody(req);
      const status = body?.status;
      if (!STATUSES.includes(status) || status === 'pending') return fail(res, 400, 'Trạng thái không hợp lệ.');
      const booking = getBooking(db, id);
      if (!booking) return fail(res, 404, 'Không tìm thấy lịch hẹn.');
      const allowed = { pending: ['confirmed','cancelled'], confirmed: ['completed','cancelled'], completed: [], cancelled: [] };
      if (!allowed[booking.status].includes(status)) return fail(res, 409, 'Không thể thay đổi trạng thái theo cách này.');
      changeBookingStatus(db, id, status);
      return json(res, 200, { ok: true, id, status });
    }
    return fail(res, 404, 'Không tìm thấy API.');
  } catch (error) {
    if (error.status) return fail(res, error.status, error.message);
    console.error('Server error:', error);
    return fail(res, 500, 'Hệ thống đang gặp sự cố. Vui lòng thử lại.');
  }
});
server.listen(PORT, '127.0.0.1', () => {
  const port = server.address().port;
  console.log(`NẾP studio demo đang chạy: http://localhost:${port}`);
  console.log(`Trang quản trị: http://localhost:${port}/admin`);
});

function shutdown() { server.close(() => { db.close(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
