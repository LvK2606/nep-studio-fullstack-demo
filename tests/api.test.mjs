import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';

const root = resolve('.');
function vnDateAfter(days) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(new Date()).filter(p => ['year','month','day'].includes(p.type)).map(p => [p.type,p.value]));
  const date = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}

test('API tích hợp: booking, SQLite, login, admin status, validation', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'nep-booking-test-'));
  const password = 'test-secure-password-123';
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd:root,
    env:{...process.env, PORT:'0', DB_PATH:join(directory,'test.sqlite'), ADMIN_PASSWORD:password, SESSION_SECRET:'x'.repeat(64)},
    stdio:['ignore','pipe','pipe']
  });
  let output='';
  const ready = new Promise((resolveReady,rejectReady) => {
    const timeout = setTimeout(() => rejectReady(new Error('Server start timeout: '+output)), 6000);
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timeout); resolveReady(Number(match[1])); }
    });
    child.stderr.on('data', chunk => output += chunk.toString());
    child.once('error', rejectReady);
    child.once('exit', code => rejectReady(new Error(`Server stopped ${code}: ${output}`)));
  });
  t.after(async () => {
    if (!child.killed) { child.kill('SIGTERM'); await Promise.race([once(child, 'exit').catch(()=>{}), new Promise(r=>setTimeout(r,1000))]); }
    rmSync(directory,{recursive:true,force:true});
  });
  const port = await ready;
  const base = `http://127.0.0.1:${port}`;
  const date = vnDateAfter(2);
  let cookie = '';
  async function api(path, method='GET', body=null, useSession=false) {
    const headers = {};
    if (body !== null) headers['Content-Type'] = 'application/json';
    if (useSession) headers.Cookie = cookie;
    const res = await fetch(base+path, {method, headers, body:body===null?undefined:JSON.stringify(body)});
    return {status:res.status, data:await res.json(), headers:res.headers};
  }
  await t.test('server phục vụ HTML và endpoint services', async () => {
    const html = await fetch(base+'/');
    assert.equal(html.status,200);
    assert.match(await html.text(),/NẾP studio/);
    assert.match(html.headers.get('content-security-policy'),/default-src/);
    const services = await api('/api/services');
    assert.equal(services.status,200);
    assert.equal(services.data.services.length,3);
  });
  await t.test('người chưa đăng nhập bị từ chối xem bookings', async () => {
    assert.equal((await api('/api/admin/bookings')).status,401);
  });
  await t.test('đặt lịch và chặn trùng giờ', async () => {
    const booking = {serviceId:'goi-duong',name:'Nguyen Van A',phone:'0900000000',date,time:'09:00',note:'Test'};
    const created = await api('/api/bookings','POST',booking);
    assert.equal(created.status,201);
    assert.equal(created.data.booking.status,'pending');
    assert.equal((await api('/api/bookings','POST',booking)).status,409);
    const slots = await api(`/api/availability?date=${date}`);
    assert.equal(slots.data.slots.find(s => s.time==='09:00').available,false);
  });
  await t.test('validation: input xấu, ngày cũ, invalid slot', async () => {
    const booking={serviceId:'goi-duong',name:'A',phone:'wrong',date,time:'05:00',note:''};
    assert.equal((await api('/api/bookings','POST',booking)).status,400);
    assert.equal((await api('/api/bookings','POST',{...booking,name:'Nguyen Van B',phone:'0900000000',date:'2020-02-03',time:'10:30'})).status,400);
    assert.equal((await api('/api/availability?date=2020-12-20')).status,400);
  });
  await t.test('đăng nhập sai, đúng; cookie HttpOnly', async () => {
    assert.equal((await api('/api/admin/login','POST',{password:'wrong'})).status,401);
    const login = await api('/api/admin/login','POST',{password});
    assert.equal(login.status,200);
    cookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'),/HttpOnly/);
    assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);
    assert.equal((await api('/api/admin/me','GET',null,true)).data.authenticated,true);
  });
  await t.test('admin xác nhận -> hoàn thành; không cho chuyển trạng thái ngược', async () => {
    const records = await api('/api/admin/bookings','GET',null,true);
    assert.equal(records.status,200);
    assert.equal(records.data.bookings.length,1);
    const id=records.data.bookings[0].id;
    assert.equal((await api(`/api/admin/bookings/${id}`,'PATCH',{status:'confirmed'},true)).status,200);
    assert.equal((await api(`/api/admin/bookings/${id}`,'PATCH',{status:'completed'},true)).status,200);
    assert.equal((await api(`/api/admin/bookings/${id}`,'PATCH',{status:'confirmed'},true)).status,409);
  });
  await t.test('hủy lịch giải phóng khung giờ', async () => {
    const b={serviceId:'da-dau',name:'Demo Client',phone:'0912345678',date,time:'10:30',note:''};
    assert.equal((await api('/api/bookings','POST',b)).status,201);
    const records = await api('/api/admin/bookings','GET',null,true);
    const id = records.data.bookings.find(x => x.time==='10:30').id;
    assert.equal((await api(`/api/admin/bookings/${id}`,'PATCH',{status:'cancelled'},true)).status,200);
    assert.equal((await api('/api/bookings','POST',b)).status,201);
  });
  await t.test('logout xóa phiên', async () => {
    const logout=await api('/api/admin/logout','POST',{},true);
    assert.equal(logout.status,200);
    assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
    assert.equal((await api('/api/admin/bookings')).status,401);
  });
});
