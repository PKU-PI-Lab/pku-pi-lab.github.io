/**
 * server.js — 本地后台服务（零依赖，纯 Node 标准库）
 *
 * 功能：
 *   - 托管整站静态文件，浏览器访问 http://localhost:8080/ 即可预览网站
 *   - 访问 http://localhost:8080/admin 进入可视化后台编辑页
 *   - /api/content  GET 读取 content/site.json；POST 保存并自动重新生成 site/index.html
 *   - /api/upload   POST 接收图片（base64），保存到 site/images/ 下指定子目录
 *
 * 启动：在 site/ 目录下运行  node admin/server.js
 * 退出：Ctrl+C
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { build } = require('../scripts/build.js');

const SITE = path.resolve(__dirname, '..'); // .../site
const ADMIN = __dirname; // .../site/admin
const CONTENT = path.join(SITE, 'content', 'site.json');
const HTML = path.join(SITE, 'index.html');
const PORT = process.env.PORT || 8080;
const MAX_BODY = 30 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

function send(res, code, body, type) {
  const headers = {};
  if (type) headers['Content-Type'] = type;
  res.writeHead(code, headers);
  res.end(body);
}

function sendJSON(res, code, obj) {
  send(res, code, JSON.stringify(obj), 'application/json; charset=utf-8');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('文件太大，超过 30 MB 限制'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function safeInside(root, target) {
  const r = path.resolve(root);
  const t = path.resolve(target);
  if (process.platform === 'win32') return t.toLowerCase().startsWith(r.toLowerCase());
  return t.startsWith(r);
}

function safePath(reqPath) {
  if (!reqPath || reqPath.includes('\0')) return null;
  // 禁止路径中的 .. 以及 Windows 盘符穿越
  const normalized = path.normalize(reqPath).replace(/^(\\|\\\\|\\?\?)/, '');
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) return null;
  return path.join(SITE, normalized);
}

function backup(file) {
  if (!fs.existsSync(file)) return;
  const bak = file + '.bak';
  try { fs.copyFileSync(file, bak); } catch (e) { /* ignore backup failure */ }
}

function validateContent(data) {
  if (!data || typeof data !== 'object') throw new Error('数据格式错误');
  const required = ['nav', 'home', 'bio', 'opportunities', 'news', 'people', 'publications', 'teaching', 'footer'];
  for (const k of required) {
    if (!(k in data)) throw new Error('缺少必要栏目：' + k);
  }
  if (!Array.isArray(data.nav) || !data.nav.length) throw new Error('导航栏目不能为空');
  for (const n of data.nav) {
    if (!n.id || !n.href) throw new Error('导航项 ID 与链接不能为空');
  }
  const ids = data.nav.map(n => n.id);
  if (new Set(ids).size !== ids.length) throw new Error('导航栏目 ID 重复');
  if (!data.home.name_en || !data.home.name_zh) throw new Error('首页姓名不能为空');
  return true;
}

const server = http.createServer(async (req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost:' + PORT).pathname);
  } catch (e) {
    return send(res, 400, 'bad url');
  }

  try {
    // ---- API: 读取内容 ----
    if (urlPath === '/api/content' && req.method === 'GET') {
      const data = fs.readFileSync(CONTENT, 'utf8');
      return send(res, 200, data, 'application/json; charset=utf-8');
    }

    // ---- API: 保存内容并重新生成前端 ----
    if (urlPath === '/api/content' && req.method === 'POST') {
      const buf = await readBody(req);
      let data;
      try {
        data = JSON.parse(buf.toString('utf8'));
      } catch (e) {
        return sendJSON(res, 400, { ok: false, error: 'JSON 解析失败：' + e.message });
      }
      try {
        validateContent(data);
      } catch (e) {
        return sendJSON(res, 400, { ok: false, error: e.message });
      }
      backup(CONTENT);
      backup(HTML);
      fs.writeFileSync(CONTENT, JSON.stringify(data, null, 2) + '\n', 'utf8');
      try {
        build();
      } catch (e) {
        // 如果生成失败，尝试回滚 content 文件
        try { fs.copyFileSync(CONTENT + '.bak', CONTENT); } catch {}
        return sendJSON(res, 500, { ok: false, error: '生成页面失败：' + e.message });
      }
      return sendJSON(res, 200, { ok: true });
    }

    // ---- API: 上传图片 ----
    if (urlPath === '/api/upload' && req.method === 'POST') {
      const buf = await readBody(req);
      let obj;
      try {
        obj = JSON.parse(buf.toString('utf8'));
      } catch (e) {
        return sendJSON(res, 400, { ok: false, error: 'JSON 解析失败' });
      }
      if (!obj.filename || !obj.data) {
        return sendJSON(res, 400, { ok: false, error: '缺少 filename/data' });
      }
      const safeName = path.basename(obj.filename).replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
      if (!safeName) return sendJSON(res, 400, { ok: false, error: '无效文件名' });

      const folder = (obj.folder || 'images/people').replace(/\\/g, '/').replace(/\.{1,2}\//g, '').replace(/^\//, '');
      if (!folder || folder.includes('..')) {
        return sendJSON(res, 400, { ok: false, error: '无效文件夹' });
      }
      // 只允许上传到 images/ 下
      if (!folder.startsWith('images/') && folder !== 'images') {
        return sendJSON(res, 400, { ok: false, error: '只能上传到 images/ 目录' });
      }

      const rel = folder + '/' + safeName;
      const full = path.join(SITE, rel);
      if (!safeInside(SITE, full)) {
        return sendJSON(res, 403, { ok: false, error: '禁止写入站外目录' });
      }

      const ext = path.extname(safeName).toLowerCase();
      if (!IMG_EXTS.has(ext)) {
        return sendJSON(res, 400, { ok: false, error: '只允许上传图片文件（jpg/png/gif/webp/svg）' });
      }

      let binary;
      try {
        binary = Buffer.from(obj.data, 'base64');
      } catch (e) {
        return sendJSON(res, 400, { ok: false, error: 'base64 解码失败' });
      }
      if (!binary.length) return sendJSON(res, 400, { ok: false, error: '文件内容为空' });

      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, binary);
      return sendJSON(res, 200, { ok: true, path: rel });
    }

    // ---- 后台编辑页 ----
    if (urlPath === '/admin' || urlPath === '/admin/') {
      const html = fs.readFileSync(path.join(ADMIN, 'index.html'), 'utf8');
      return send(res, 200, html, 'text/html; charset=utf-8');
    }

    // ---- 静态文件（整站预览）----
    const filePath = safePath(urlPath) || path.join(SITE, urlPath);
    if (!filePath || !safeInside(SITE, filePath)) {
      return send(res, 403, 'forbidden');
    }
    if (urlPath.endsWith('/')) {
      return send(res, 200, fs.readFileSync(path.join(SITE, 'index.html')), 'text/html; charset=utf-8');
    }
    fs.readFile(filePath, (err, data) => {
      if (err) return send(res, 404, 'Not found');
      const ext = path.extname(filePath).toLowerCase();
      send(res, 200, data, MIME[ext] || 'application/octet-stream');
    });
  } catch (e) {
    sendJSON(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, () => {
  console.log('本地后台已启动：');
  console.log('  编辑后台  ->  http://localhost:' + PORT + '/admin');
  console.log('  网站预览  ->  http://localhost:' + PORT + '/');
  console.log('提示：修改内容后点“保存并生成”，再刷新预览；最后 git push 到 GitHub 即可上线。');
});
