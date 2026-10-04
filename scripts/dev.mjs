import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import './build.mjs';
const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/plain', '.sql': 'text/plain' };
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(root + sep)) throw new Error('Invalid path');
    await stat(file);
    res.setHeader('Content-Type', (mime[extname(file)] || 'application/octet-stream') + '; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(Number(process.env.PORT || 4173), '0.0.0.0', () => console.log('Portfolio preview: http://localhost:4173'));
