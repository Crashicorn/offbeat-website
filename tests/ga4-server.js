/* Static file server for the GA4 consent/minimization capture tests.
 * Usage: node tests/ga4-server.js <port>   (defaults to 8236)
 * Serves the repository read-only over HTTP on localhost for tests/ga4-consent.harness.html
 * and assets/. Used only by tests/ga4-chromium.test.sh.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.argv[2] || '8236', 10);
function mime(p) { return p.endsWith('.js') ? 'text/javascript' : (p.endsWith('.css') ? 'text/css' : (p.endsWith('.html') ? 'text/html' : 'text/plain')); }
http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { req.url = '/404'; }
  const f = path.resolve(ROOT, path.normalize(p).replace(/^([/\\])+/, ''));
  if (f !== ROOT && !f.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': mime(p), 'Content-Length': d.length, 'Cache-Control': 'no-store' });
    res.end(d);
  });
}).listen(PORT, '127.0.0.1', () => console.log('up on ' + PORT));
