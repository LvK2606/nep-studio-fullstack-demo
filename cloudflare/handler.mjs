// Cloudflare Workers adapter: no always-running server, no idle spin-down.
// All secrets are bound from the Cloudflare runtime (never from browser code).
const TIME_SLOTS = ['09:00', '10:30', '13:30', '15:00', '16:30'];
const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const COOKIE_NAME = 'nep_session';
const SESSION_MS = 8 * 60 * 60 * 1000;
const encoder = new TextEncoder();

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
  'Cache-Control': 'no-store'
};
function reply(status, value, extras = {}) {
  return new Response(JSON.stringify(value), {
    status, headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...extras }
  });
}
function fail(status, error) { return reply(status, { error }); }

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function fromBase64url(value) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) return null;
  try {
    const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
  } catch { return null; }
}
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function newSessionCookie(env) {
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(12)));
  const payload = base64url(encoder.encode(JSON.stringify({ exp: Date.now() + SESSION_MS, nonce })));
  const signature = base64url(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(env.SESSION_SECRET), encoder.encode(payload))));
  return COOKIE_NAME + '=' + payload + '.' + signature + '; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=' + (SESSION_MS / 1000);
}
async function isLoggedIn(request, env) {
  const pair = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE_NAME + '='));
  if (!pair) return false;
  const token = pair.slice(COOKIE_NAME.length + 1);
  if (token.length > 500) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const bytes = fromBase64url(parts[1]);
  if (!bytes || bytes.length !== 32) return false;
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(env.SESSION_SECRET), bytes, encoder.encode(parts[0]));
  if (!valid) return false;
  const payload = fromBase64url(parts[0]);
  if (!payload) return false;
  try {
    const obj = JSON.parse(new TextDecoder().decode(payload));
    return Number.isFinite(obj.exp) && obj.exp > Date.now() && obj.exp <= Date.now() + SESSION_MS;
  } catch { return false; }
}
async function hash(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}
async function safeCompare(candidate, reference) {
  const [a, b] = await Promise.all([hash(candidate), hash(reference)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function throttleKey(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const result = await hash(env.SESSION_SECRET + ':' + ip);
  return Array.from(result.slice(0, 20), b => b.toString(16).padStart(2, '0')).join('');
}
function vietnamClock() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).filter(x => ['year','month','day','hour','minute'].includes(x.type))
    .map(x => [x.type, x.value]));
  return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
  const diff = (Date.parse(value) - Date.parse(vietnamClock().date)) / 86400000;
  return diff >= 0 && diff <= 60;
}
function futureSlot(date, time) {
  const now = vietnamClock();
  return date > now.date || date === now.date && time > now.time;
}
async function jsonBody(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    throw Object.assign(new Error('Dữ liệu phải ở định dạng JSON.'), { status: 415 });
  }
  if (Number(request.headers.get('content-length') || 0) > 16384) {
    throw Object.assign(new Error('Nội dung quá dài.'), { status: 413 });
  }
  const value = await request.text();
  if (encoder.encode(value).length > 16384) throw Object.assign(new Error('Nội dung quá dài.'), { status: 413 });
  try { return JSON.parse(value); }
  catch { throw Object.assign(new Error('JSON không hợp lệ.'), { status: 400 }); }
}
function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}
async function validateBooking(raw, sql) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Thông tin đặt lịch không hợp lệ.';
  const { serviceId, name, phone, date, time, note } = raw;
  if (typeof serviceId !== 'string' || !(await sql.query('SELECT 1 FROM services WHERE id=$1', [serviceId])).length) return 'Vui lòng chọn dịch vụ hợp lệ.';
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return 'Họ tên phải từ 2 đến 80 ký tự.';
  if (typeof phone !== 'string' || !/^(?:\+84|0)[0-9]{9,10}$/.test(phone.replace(/[.\s-]/g, ''))) return 'Số điện thoại Việt Nam không hợp lệ.';
  if (!validDate(date)) return 'Chỉ đặt lịch trong 60 ngày tới.';
  if (!TIME_SLOTS.includes(time)) return 'Giờ hẹn không hợp lệ.';
  if (typeof note !== 'string' || note.length > 500) return 'Ghi chú tối đa 500 ký tự.';
  return null;
}

export async function handleRequest(request, env, sql) {
  try {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (!env.DATABASE_URL || !env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 12 || !env.SESSION_SECRET || env.SESSION_SECRET.length < 48) {
      return fail(503, 'Website chưa được cấu hình đầy đủ.');
    }
    if (path === '/admin' && method === 'GET') {
      if (!env.ASSETS) return fail(503, 'Giao diện quản trị chưa được triển khai.');
      // Use the canonical /admin URL: Cloudflare auto-redirects /admin.html to /admin.
      // Fetching /admin.html from ASSETS would otherwise create an infinite redirect loop.
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
      return new Response(response.body, { status: response.status, headers });
    }
    if (!path.startsWith('/api/')) return fail(404, 'Không tìm thấy trang.');
    if (!['GET','POST','PATCH'].includes(method)) return fail(405, 'Phương thức không được hỗ trợ.');
    if (method !== 'GET' && !sameOrigin(request)) return fail(403, 'Yêu cầu khác nguồn bị từ chối.');

    if (method === 'GET' && path === '/api/services')
      return reply(200, { services: await sql.query('SELECT id,name,duration,price,description,icon FROM services ORDER BY price ASC', []) });

    if (method === 'GET' && path === '/api/availability') {
      const date = url.searchParams.get('date');
      if (!validDate(date)) return fail(400, 'Ngày không hợp lệ hoặc ngoài khoảng 60 ngày.');
      const rows = await sql.query("SELECT booking_time FROM bookings WHERE booking_date=$1 AND status!='cancelled'", [date]);
      const taken = new Set(rows.map(r => r.booking_time));
      return reply(200, { date, slots: TIME_SLOTS.map(time => ({ time, available: !taken.has(time) && futureSlot(date, time) })) });
    }

    if (method === 'POST' && path === '/api/bookings') {
      const body = await jsonBody(request);
      const error = await validateBooking(body, sql);
      if (error) return fail(400, error);
      if (!futureSlot(body.date, body.time)) return fail(400, 'Không thể đặt khung giờ đã qua.');
      try {
        const rows = await sql.query('INSERT INTO bookings (service_id,customer_name,phone,booking_date,booking_time,note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
          [body.serviceId, body.name.trim(), body.phone.replace(/[.\s-]/g, ''), body.date, body.time, body.note.trim()]);
        return reply(201, { message: 'Đã nhận yêu cầu đặt lịch.', booking: { id: Number(rows[0].id), date: body.date, time: body.time, status: 'pending' } });
      } catch (e) {
        if (e?.code === '23505') return fail(409, 'Khung giờ này vừa được đặt. Vui lòng chọn giờ khác.');
        throw e;
      }
    }
    if (method === 'POST' && path === '/api/admin/login') {
      const body = await jsonBody(request);
      const ipKey = await throttleKey(request, env);
      const attempts = await sql.query('SELECT count FROM admin_login_attempts WHERE ip_key=$1 AND window_end > now()', [ipKey]);
      if (attempts[0]?.count >= 6) return fail(429, 'Đã thử quá nhiều lần. Hãy quay lại sau 15 phút.');
      const ok = await safeCompare(typeof body?.password === 'string' ? body.password : '', env.ADMIN_PASSWORD);
      if (!ok) {
        const result = await sql.query("INSERT INTO admin_login_attempts(ip_key,count,window_end) VALUES ($1,1,now()+interval '15 minutes') ON CONFLICT(ip_key) DO UPDATE SET count=CASE WHEN admin_login_attempts.window_end < now() THEN 1 ELSE admin_login_attempts.count+1 END, window_end=CASE WHEN admin_login_attempts.window_end < now() THEN now()+interval '15 minutes' ELSE admin_login_attempts.window_end END RETURNING count", [ipKey]);
        if (result[0]?.count >= 6) return fail(429, 'Đã thử quá nhiều lần. Hãy quay lại sau 15 phút.');
        return fail(401, 'Mật khẩu không đúng.');
      }
      await sql.query('DELETE FROM admin_login_attempts WHERE ip_key=$1', [ipKey]);
      return reply(200, { ok: true }, { 'Set-Cookie': await newSessionCookie(env) });
    }
    if (method === 'GET' && path === '/api/admin/me')
      return reply(200, { authenticated: await isLoggedIn(request, env) });
    if (method === 'POST' && path === '/api/admin/logout')
      return reply(200, { ok: true }, { 'Set-Cookie': COOKIE_NAME + '=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0' });

    if (path.startsWith('/api/admin/') && !(await isLoggedIn(request, env))) return fail(401, 'Vui lòng đăng nhập quản trị.');
    if (method === 'GET' && path === '/api/admin/bookings') {
      const rows = await sql.query('SELECT b.id,b.customer_name AS name,b.phone,b.booking_date AS date,b.booking_time AS time,b.note,b.status,b.created_at AS "createdAt",s.name AS "serviceName",s.price FROM bookings b JOIN services s ON s.id=b.service_id ORDER BY b.booking_date DESC,b.booking_time DESC,b.id DESC', []);
      return reply(200, { bookings: rows.map(r => ({ ...r, id: Number(r.id) })) });
    }
    const match = path.match(/^\/api\/admin\/bookings\/(\d+)$/);
    if (method === 'PATCH' && match) {
      const id = Number(match[1]);
      if (!Number.isSafeInteger(id) || id < 1) return fail(400, 'ID không hợp lệ.');
      const body = await jsonBody(request), status = body?.status;
      if (!STATUSES.includes(status) || status === 'pending') return fail(400, 'Trạng thái không hợp lệ.');
      const rows = await sql.query('SELECT id,status FROM bookings WHERE id=$1', [id]);
      const booking = rows[0];
      if (!booking) return fail(404, 'Không tìm thấy lịch hẹn.');
      const allowed = { pending: ['confirmed','cancelled'], confirmed: ['completed','cancelled'], completed: [], cancelled: [] };
      if (!allowed[booking.status]?.includes(status)) return fail(409, 'Không thể thay đổi trạng thái theo cách này.');
      const updated = await sql.query('UPDATE bookings SET status=$1 WHERE id=$2 AND status=$3 RETURNING id', [status, id, booking.status]);
      if (!updated.length) return fail(409, 'Trạng thái lịch hẹn vừa thay đổi. Vui lòng tải lại.');
      return reply(200, { ok: true, id, status });
    }
    return fail(404, 'Không tìm thấy API.');
  } catch (e) {
    if (e?.status) return fail(e.status, e.message);
    console.error('Worker request failed:', e?.code || e?.name || 'unknown');
    return fail(500, 'Hệ thống đang gặp sự cố. Vui lòng thử lại.');
  }
}
