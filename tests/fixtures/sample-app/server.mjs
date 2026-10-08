// A tiny notes app: static files from public/ and a JSON API kept in memory.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const MAX_TITLE = 120;

export function createServer() {
  const notes = [];
  return http.createServer(async (req, res) => {
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': type });
      res.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    if (req.url === '/api/notes' && req.method === 'GET') return send(200, notes);
    if (req.url === '/api/notes' && req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      let title;
      try {
        title = String(JSON.parse(raw).title ?? '').trim();
      } catch {
        return send(400, { error: 'Invalid JSON' });
      }
      if (!title || title.length > MAX_TITLE) return send(400, { error: `Title must be 1-${MAX_TITLE} characters` });
      const note = { id: notes.length + 1, title };
      notes.push(note);
      return send(201, note);
    }
    const file = path.join(PUBLIC, req.url === '/' ? 'index.html' : path.normalize(req.url));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) return send(404, { error: 'Not found' });
    send(200, fs.readFileSync(file, 'utf8'), TYPES[path.extname(file)] ?? 'text/plain');
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => console.log(`Notes app on http://localhost:${port}`));
}
