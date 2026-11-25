// Serves dist/ like the Cloudflare Worker does: /path/ -> /path/index.html.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(root, p);
  try { if ((await stat(f)).isDirectory()) f = path.join(f, 'index.html'); } catch { }
  try {
    const body = await readFile(f);
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end(await readFile(path.join(root, '404.html')));
  }
}).listen(process.env.PORT || 4321, () => console.log('http://localhost:' + (process.env.PORT || 4321)));
