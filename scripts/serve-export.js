#!/usr/bin/env node
/* Serves the static export at /retroarch-overlay-studio/ like GitHub Pages does. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || path.join(__dirname, '..', 'testroot');
const PORT = Number(process.argv[3] || 4173);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.txt': 'text/plain', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.cfg': 'text/plain',
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  // ROOT contains a symlink named after the repo, so paths resolve GH-Pages-style
  let fp = path.normalize(path.join(ROOT, urlPath));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, 'index.html');
  fs.readFile(fp, (err, data) => {
    if (err) {
      // GH Pages style 404
      const nf = path.join(ROOT, 'retroarch-overlay-studio', '404.html');
      if (fs.existsSync(nf)) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        return res.end(fs.readFileSync(nf));
      }
      res.writeHead(404); return res.end('Not found: ' + urlPath);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`serving ${ROOT} at http://localhost:${PORT}/retroarch-overlay-studio/`));
