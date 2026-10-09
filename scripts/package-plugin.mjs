#!/usr/bin/env node
// Packages the Claude plugin (dist/claude) as out/senior-ai.plugin: the zip file Claude's Chat and
// Cowork accept. Send it in a Cowork chat and press Accept to add senior-ai to your claude.ai account.
//   node scripts/package-plugin.mjs
// Plain Node (no zip tool needed), so it works on macOS, Linux and Windows. Run `node build/index.mjs` first.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(REPO, 'dist', 'claude');
const NAME = JSON.parse(fs.readFileSync(path.join(SOURCE, '.claude-plugin', 'plugin.json'), 'utf8')).name;
const OUT = path.join(REPO, 'out', `${NAME}.plugin`); // out/ is git-ignored; releases attach the file

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// Every file under dir, as zip paths with forward slashes, sorted so the archive is stable.
function listFiles(dir, prefix = '') {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.name !== '.DS_Store')
    .flatMap(entry => {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listFiles(path.join(dir, entry.name), rel) : [rel];
    })
    .sort();
}

// A minimal zip writer: deflated entries, fixed timestamps (1980-01-01), UTF-8 names.
export function zipDirectory(dir) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const name of listFiles(dir)) {
    const data = fs.readFileSync(path.join(dir, ...name.split('/')));
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // UTF-8 names
    header.writeUInt16LE(8, 8); // deflate
    header.writeUInt16LE(0, 10); // time
    header.writeUInt16LE(0x21, 12); // date: 1980-01-01
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    locals.push(header, nameBuf, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4); // made by: Unix, zip 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // regular file, rw-r--r--
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += header.length + nameBuf.length + packed.length;
  }
  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length / 2, 8);
  end.writeUInt16LE(centrals.length / 2, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, end]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!fs.existsSync(SOURCE)) {
    console.error('dist/claude is missing. Run: node build/index.mjs');
    process.exit(2);
  }
  const zip = zipDirectory(SOURCE);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, zip);
  console.log(`Wrote ${path.relative(REPO, OUT)} (${Math.round(zip.length / 1024)} KB, ${listFiles(SOURCE).length} files)`);
}
