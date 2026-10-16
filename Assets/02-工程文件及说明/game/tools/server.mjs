import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
};
const allow = /^(?:index\.html|style\.css|src\/|assets\/|vendor\/|dev\/)/;
export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const rel =
        decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') ||
        'index.html';
      if (rel === 'health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ app: 'bubble-ticket-arcade', version }));
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405);
        return res.end();
      }
      const file = path.resolve(root, rel);
      if (!file.startsWith(root + path.sep) || !allow.test(rel) || !mime[path.extname(file)])
        throw Error('Not public');
      const data = await fs.readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)],
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.GAME_PORT || 4210);
  const server = createServer();
  server.on('error', (e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () =>
    console.log('Bubble Arcade ' + version + ': http://127.0.0.1:' + port + '/'),
  );
}
