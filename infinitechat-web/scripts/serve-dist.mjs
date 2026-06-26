import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const host = process.env.HOST || '0.0.0.0';
const preferredPort = Number(process.env.PORT || 4174);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveFile(requestUrl) {
  const url = new URL(requestUrl || '/', 'http://localhost');
  let pathname = normalize(decodeURIComponent(url.pathname));
  if (pathname.includes('..')) return null;
  if (pathname === '/' || !extname(pathname)) pathname = '/index.html';
  const file = join(root, pathname);
  if (!file.startsWith(root)) return null;
  if (!existsSync(file) || statSync(file).isDirectory()) return join(root, 'index.html');
  return file;
}

function createStaticServer() {
  return createServer((req, res) => {
    try {
      const file = resolveFile(req.url);
      if (!file) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      res.writeHead(200, {
        'content-type': mime[extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(readFileSync(file));
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(String(error?.stack || error));
    }
  });
}

function listen(port) {
  const server = createStaticServer();

  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && !process.env.PORT) {
      listen(port + 1);
      return;
    }
    throw error;
  });

  server.listen(port, host, () => {
    const actualPort = server.address().port;
    console.log(`InfiniteChat web serving ${root}`);
    console.log(`Local:   http://localhost:${actualPort}/`);
    console.log(`Network: http://192.168.112.154:${actualPort}/`);
  });
}

listen(preferredPort);
