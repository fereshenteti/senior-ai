import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from '../server.mjs';

async function withServer(fn) {
  const server = createServer().listen(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

test('adds and lists notes', () =>
  withServer(async base => {
    const created = await fetch(`${base}/api/notes`, { method: 'POST', body: JSON.stringify({ title: 'Buy milk' }) });
    assert.equal(created.status, 201);
    assert.deepEqual(await (await fetch(`${base}/api/notes`)).json(), [{ id: 1, title: 'Buy milk' }]);
  }));

test('rejects empty titles', () =>
  withServer(async base => {
    const response = await fetch(`${base}/api/notes`, { method: 'POST', body: JSON.stringify({ title: '  ' }) });
    assert.equal(response.status, 400);
  }));
