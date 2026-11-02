import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../cloudflare/handler.mjs';

const environment = { DATABASE_URL:'test-connection', ADMIN_PASSWORD:'password-for-local-tests', SESSION_SECRET:'s'.repeat(64), ASSETS:{fetch:async()=>new Response('Admin') } };
const sql = {
  async query(text, params=[]) {
    if(text.startsWith('SELECT id,name,duration')) return [{id:'goi-duong',name:'Sample',duration:45,price:250000,description:'Demo',icon:'sparkle'}];
    if(text.startsWith('SELECT 1 FROM services')) return params[0]==='goi-duong'?[{exists:1}]:[];
    if(text.startsWith('SELECT booking_time')) return [];
    if(text.startsWith('SELECT count FROM admin_login_attempts')) return [];
    if(text.startsWith('DELETE FROM admin_login_attempts')) return [];
    if(text.startsWith('SELECT b.id,b.customer_name')) return [];
    if(text.startsWith('SELECT id,status')) return [];
    if(text.startsWith('INSERT INTO bookings')) return [{id:'1'}];
    throw Error('Unexpected SQL test query: '+text);
  }
};
function request(path, method='GET', body, cookie) {
  const headers={};
  if(body!==undefined)headers['Content-Type']='application/json';
  if(cookie)headers.Cookie=cookie;
  return new Request('https://nep.test'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
}
test('Cloudflare handler: public API and validation', async()=>{
  const res=await handleRequest(request('/api/services'),environment,sql);
  assert.equal(res.status,200);
  assert.equal((await res.json()).services.length,1);
  assert.equal((await handleRequest(request('/api/availability?date=bad'),environment,sql)).status,400);
  assert.equal((await handleRequest(request('/api/admin/bookings'),environment,sql)).status,401);
  assert.equal((await handleRequest(request('/api/services'),{...environment,DATABASE_URL:''},sql)).status,503);
});
test('Cloudflare handler: login, signed cookie, logout',async()=>{
  const bad=await handleRequest(request('/api/admin/login','POST',{password:'incorrect'}),environment,{...sql,query:async(q,p)=>q.startsWith('INSERT INTO admin_login_attempts')?[{count:1}]:sql.query(q,p)});
  assert.equal(bad.status,401);
  const good=await handleRequest(request('/api/admin/login','POST',{password:environment.ADMIN_PASSWORD}),environment,sql);
  assert.equal(good.status,200);
  const cookie=good.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly; SameSite=Strict; Secure/);
  const pair=cookie.split(';')[0];
  assert.equal((await (await handleRequest(request('/api/admin/me','GET',undefined,pair),environment,sql)).json()).authenticated,true);
  assert.equal((await handleRequest(request('/api/admin/bookings','GET',undefined,pair),environment,sql)).status,200);
  assert.equal((await handleRequest(request('/api/admin/logout','POST',{},pair),environment,sql)).status,200);
});
test('Cloudflare handler: admin static asset and cross-origin protections',async()=>{
  // Cloudflare static assets redirect /admin.html to canonical /admin.
  // The Worker must request /admin directly to prevent ERR_TOO_MANY_REDIRECTS.
  const seen=[];
  const strictAssets={...environment,ASSETS:{fetch:async req=>{
    const p=new URL(req.url).pathname;
    seen.push(p);
    if(p==='/admin.html')return Response.redirect('https://nep.test/admin',307);
    if(p==='/admin')return new Response('<!doctype html><title>Admin</title>',{status:200,headers:{'Content-Type':'text/html'}});
    return new Response('Not Found',{status:404});
  }}};
  const admin=await handleRequest(request('/admin'),strictAssets,sql);
  assert.equal(admin.status,200);
  assert.equal(admin.headers.get('location'),null);
  assert.match(await admin.text(),/Admin/);
  assert.deepEqual(seen,['/admin']);
  assert.equal(admin.headers.get('x-frame-options'),'DENY');
  const req=request('/api/admin/login','POST',{password:'test'});
  req.headers.set('origin','https://other.example');
  assert.equal((await handleRequest(req,environment,sql)).status,403);
});
