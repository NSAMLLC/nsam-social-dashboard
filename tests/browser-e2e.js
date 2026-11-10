// Real-Chromium test of admin.html against an ISOLATED local n8n (fictional secret).
// NOTE: the page is served from a real local server (http://127.0.0.1:8099, listed in the test Webhook's Allowed Origins) so
// Chromium's Local Network Access rule (public page -> loopback) does not mask the CORS result; the call is still cross-origin
// with a real preflight for the custom header.
// usage: node tests/browser-e2e.js <admin.html path> <config.js path> <good-secret> <expect: pass|legacy>
const { chromium } = require('playwright');
const fs = require('fs');
const [adminPath, configPath, GOOD, mode] = process.argv.slice(2);
const BASE = 'http://127.0.0.1:5678';
const http = require('http');
const server = http.createServer((q, r) => {
  if (q.url.endsWith('/admin.html')) { r.setHeader('Content-Type', 'text/html'); return r.end(fs.readFileSync(adminPath, 'utf8')); }
  if (q.url.endsWith('/config.js')) { r.setHeader('Content-Type', 'application/javascript'); return r.end(fs.readFileSync(configPath, 'utf8').replace('https://nsam.app.n8n.cloud', BASE).replace(/\/webhook\/nsam-sm-/g, '/webhook/test-sm-')); }
  r.statusCode = 404; r.end();
});
const ORIGIN = 'http://127.0.0.1:8099';
const PAGE = ORIGIN + '/nsam-social-dashboard/admin.html';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  await new Promise(res => server.listen(8099, '127.0.0.1', res));
  const browser = await chromium.launch();
  async function session(secret) {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    const reqs = []; const client = await ctx.newCDPSession(page); await client.send('Network.enable');
    client.on('Network.requestWillBeSentExtraInfo', e => { if (e.headers[':method']==='OPTIONS'||e.headers['Access-Control-Request-Method']) reqs.push({ method:'OPTIONS', url:'', headers:Object.fromEntries(Object.entries(e.headers).map(([k,v])=>[k.toLowerCase(),v])) }); });
    page.on('request', q => { if (q.url().startsWith(BASE)) reqs.push({ method: q.method(), url: q.url(), headers: q.headers(), body: q.postData() }); });
    const cors = []; page.on('requestfailed', q => cors.push(q.failure()?.errorText));
    await page.goto(PAGE);
    await page.fill('#token', secret);
    await page.click('text=Sign in');
    await page.waitForTimeout(1500);
    const appVisible = await page.evaluate(() => !document.getElementById('app').classList.contains('hidden'));
    const msg = await page.evaluate(() => document.getElementById('loginMsg').textContent);
    await ctx.close(); return { reqs, appVisible, msg, cors };
  }
  const good = await session(GOOD);
  const bad = await session('WRONG-FICTIONAL');
  const post = good.reqs.filter(r => r.method === 'POST'), pre = good.reqs.filter(r => r.method === 'OPTIONS');
  if (mode === 'pass') {
    ok(good.appVisible, 'correct secret signs in and loads the board');
    ok(pre.length > 0, 'browser sent a CORS preflight (OPTIONS) and it was accepted');
    ok(pre.every(r => /x-nsam-admin-token/i.test(r.headers['access-control-request-headers'] || '')), 'preflight requests the custom header');
    ok(post.length > 0 && post.every(r => r.headers['x-nsam-admin-token'] === GOOD), 'POST carries the secret in the X-NSAM-Admin-Token header');
    ok(post.every(r => !/token/i.test(r.body || '')), 'POST body contains no token field');
    ok(post.every(r => !r.url.includes(GOOD) && !r.url.includes('?')), 'secret is not in the URL');
    ok(!bad.appVisible && /Could not sign in/.test(bad.msg), 'wrong secret is refused at login (403 handled)');
    ok(!bad.cors.some(e => /CORS|ERR_FAILED/i.test(e || '')), 'rejection response is CORS-readable (no opaque network failure)');
  } else {
    ok(!good.appVisible, 'LEGACY admin.html cannot sign in against a Header-Auth webhook (expected; proves dashboard must ship first/with it)');
  }
  await browser.close(); server.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
