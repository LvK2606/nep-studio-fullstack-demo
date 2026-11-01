import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path) { return readFileSync(new URL('../' + path, import.meta.url), 'utf8'); }
test('Vietnamese typography: both screens load the same complete font families', () => {
  for (const path of ['public/index.html', 'public/admin.html']) {
    const html = source(path);
    assert.match(html, /<html lang="vi">/);
    assert.match(html, /<meta charset="utf-8">/);
    assert.match(html, /family=Be\+Vietnam\+Pro/);
    assert.match(html, /family=Noto\+Serif/);
    assert.match(html, /display=swap/);
  }
});
test('Vietnamese typography: fonts have local fallback and safe heading spacing', () => {
  const css = source('public/styles.css');
  assert.match(css, /--font-body:"Be Vietnam Pro","Segoe UI",Tahoma,Arial,sans-serif/);
  assert.match(css, /--font-display:"Noto Serif",Cambria,"Times New Roman",serif/);
  assert.match(css, /font-family:var\(--font-body\)/);
  assert.match(css, /font-family:var\(--font-display\)/);
  assert.match(css, /line-height:1\.16/);
});
test('Content Security Policy permits font stylesheet and webfont downloads', () => {
  for (const path of ['cloudflare/handler.mjs','server.mjs']) {
    const js = source(path);
    assert.match(js, /style-src 'self' https:\/\/fonts\.googleapis\.com/);
    assert.match(js, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
  }
});
