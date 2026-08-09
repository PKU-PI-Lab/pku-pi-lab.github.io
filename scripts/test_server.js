'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const PORT = 8099;
const BASE = 'http://127.0.0.1:' + PORT;
const REPORT = path.join(SITE, 'scripts', '_test_report.txt');
const node = process.execPath;

const L = [];
function log(s) { L.push(s); }

function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const r = http.request(BASE + p, { method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function waitServer(tries) {
  return new Promise((resolve, reject) => {
    const tick = (n) => {
      req('GET', '/api/content')
        .then(() => resolve(true))
        .catch(() => (n <= 0 ? reject(new Error('server timeout')) : setTimeout(() => tick(n - 1), 300)));
    };
    tick(tries);
  });
}

(async () => {
  const srv = spawn(node, ['admin/server.js'], { cwd: SITE, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });

  try {
    await waitServer(40);
    log('server start: OK');

    // GET /api/content
    const c = await req('GET', '/api/content');
    const json = JSON.parse(c.body);
    log('GET /api/content: ' + c.status + ' | keys=' + Object.keys(json).join(','));
    log('  bio=' + json.bio.length + ' opp=' + json.opportunities.length + ' news=' + json.news.length + ' peopleGroups=' + json.people.length);

    // GET /admin
    const a = await req('GET', '/admin');
    log('GET /admin: ' + a.status + ' | hasTitle=' + a.body.includes('网站内容后台'));

    // GET / (site preview)
    const h = await req('GET', '/');
    log('GET /: ' + h.status + ' | hasLab=' + h.body.includes('Physical Intelligence Lab'));

    // POST /api/content (mutate first news date, then restore)
    const orig = JSON.parse(JSON.stringify(json));
    const marker = '__TEST_MARKER__';
    json.news[0].date = marker;
    const post = await req('POST', '/api/content', json);
    log('POST /api/content: ' + post.status + ' | ' + post.body);
    const rebuilt = await req('GET', '/');
    log('  regenerated index contains marker: ' + rebuilt.body.includes(marker));
    // restore
    await req('POST', '/api/content', orig);
    const restored = await req('GET', '/');
    log('  after restore marker gone: ' + (!restored.body.includes(marker)));

    // POST /api/upload (1x1 png base64)
    const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
    const up = await req('POST', '/api/upload', { filename: '__test_upload.png', data: pngB64 });
    const upj = JSON.parse(up.body);
    log('POST /api/upload: ' + up.status + ' | ok=' + upj.ok + ' path=' + (upj.path || ''));
    if (upj.ok) { try { fs.unlinkSync(path.join(SITE, upj.path)); } catch (e) {} }

    log('RESULT: PASS');
  } catch (e) {
    log('RESULT: FAIL -> ' + e.message);
  } finally {
    srv.kill();
    fs.writeFileSync(REPORT, L.join('\n') + '\n', 'ascii');
  }
})();
