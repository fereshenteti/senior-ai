import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';
import { zipDirectory } from '../../scripts/package-plugin.mjs';
import { tempDir } from '../helpers.mjs';

// Reads every entry of a zip through its central directory.
function readZip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(at), 0x02014b50);
    const size = buf.readUInt32LE(at + 20);
    const nameLength = buf.readUInt16LE(at + 28);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    assert.equal(buf.readUInt32LE(local), 0x04034b50);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    files[name] = zlib.inflateRawSync(buf.subarray(dataStart, dataStart + size)).toString('utf8');
    at += 46 + nameLength + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
  }
  return files;
}

test('packages a folder as a zip with forward-slash paths and exact contents', () => {
  const dir = tempDir();
  fs.mkdirSync(path.join(dir, '.claude-plugin'));
  fs.mkdirSync(path.join(dir, 'skills', 'a11y'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), '{"name":"senior-ai"}');
  fs.writeFileSync(path.join(dir, 'skills', 'a11y', 'SKILL.md'), '# Accessibility ✓');
  fs.writeFileSync(path.join(dir, '.DS_Store'), 'junk');
  const files = readZip(zipDirectory(dir));
  assert.deepEqual(Object.keys(files), ['.claude-plugin/plugin.json', 'skills/a11y/SKILL.md']);
  assert.equal(files['skills/a11y/SKILL.md'], '# Accessibility ✓');
});

test('the same input gives the same archive', () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, 'a.md'), 'x');
  assert.deepEqual(zipDirectory(dir), zipDirectory(dir));
});
