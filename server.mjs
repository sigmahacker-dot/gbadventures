import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import api from './netlify/functions/api.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

async function handleApi(req, res, url) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  const result = await api({ rawUrl: `http://${req.headers.host || 'localhost'}${url}`, path: url, httpMethod: req.method, body: body || null, headers: req.headers });
  res.statusCode = result.statusCode || 200;
  for (const [key, value] of Object.entries(result.headers || {})) res.setHeader(key, value);
  res.end(result.body || '');
}

async function serveStatic(req, res, url) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
  if (pathname === '/admin') pathname = '/admin.html';
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) throw new Error('not a file');
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': pathname.endsWith('.html') ? 'no-cache' : 'public, max-age=3600' });
    if (req.method === 'HEAD') return res.end();
    res.end(await fs.readFile(file));
  } catch {
    try { res.writeHead(200, { 'Content-Type': types['.html'] }); res.end(await fs.readFile(path.join(root, '404.html'))); } catch { res.writeHead(404); res.end('Not found'); }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url || '/';
    if (url === '/health' || url === '/healthz') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true })); }
    if (url === '/api' || url.startsWith('/api/')) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (error) { console.error('Request failed:', error); if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('Internal server error'); }
});
server.listen(port, '0.0.0.0', () => console.log(`GB Adventure server listening on port ${port}`));
