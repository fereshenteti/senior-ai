#!/usr/bin/env node
// Renders a Storybook story (or any URL) and pixel-compares it with a reference image.
// Dependencies are resolved from the project in the current working directory:
//   npm i -D playwright pixelmatch pngjs && npx playwright install chromium

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const USAGE = `Usage:
  node visual-check.mjs --story <story-id> --ref <reference.png> [options]
  node visual-check.mjs --page <url> --ref <reference.png> [options]

Options:
  --story <id>          Storybook story id, e.g. components-button--all-states
  --page <url>          Full URL to render instead of a story
  --ref <file>          Reference PNG (the design's state sheet)
  --url <base>          Storybook base URL (default: http://localhost:6006)
  --scale <n>           Pixel ratio of the reference image: 1 or 2 (default: 1)
  --selector <css>      Screenshot this element instead of the viewport
  --threshold <0-1>     Per-pixel color tolerance (default: 0.1)
  --max-mismatch <pct>  Pass if mismatching pixels <= this percent (default: 0.5)
  --out <dir>           Output folder (default: .visual-check)

Exit codes: 0 pass, 1 mismatch above limit, 2 setup/usage error.`;

const GRID = 6;

function parseArgs(argv) {
  const opts = {
    url: 'http://localhost:6006',
    scale: 1,
    threshold: 0.1,
    maxMismatch: 0.5,
    out: '.visual-check',
  };
  const keys = {
    '--story': 'story', '--page': 'page', '--ref': 'ref', '--url': 'url', '--scale': 'scale',
    '--selector': 'selector', '--threshold': 'threshold', '--max-mismatch': 'maxMismatch', '--out': 'out',
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-h' || argv[i] === '--help') fail(USAGE, 0);
    const key = keys[argv[i]];
    if (!key || argv[i + 1] === undefined) fail(`Unknown or incomplete option: ${argv[i]}\n\n${USAGE}`);
    opts[key] = argv[++i];
  }
  for (const k of ['scale', 'threshold', 'maxMismatch']) opts[k] = Number(opts[k]);
  if (!opts.ref || (!opts.story && !opts.page)) fail(USAGE);
  return opts;
}

function fail(message, code = 2) {
  (code === 0 ? console.log : console.error)(message);
  process.exit(code);
}

function pickEntry(pkg) {
  const resolve = target => {
    if (typeof target === 'string') return target;
    if (!target || typeof target !== 'object') return null;
    for (const cond of ['import', 'node', 'default', 'require']) {
      const hit = resolve(target[cond]);
      if (hit) return hit;
    }
    return null;
  };
  const exp = pkg.exports;
  const root = exp && typeof exp === 'object' && '.' in exp ? exp['.'] : exp;
  return resolve(root) || pkg.module || pkg.main || 'index.js';
}

async function loadFromProject(name) {
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    const pkgDir = path.join(dir, 'node_modules', name);
    const pkgFile = path.join(pkgDir, 'package.json');
    if (fs.existsSync(pkgFile)) {
      const entry = pickEntry(JSON.parse(fs.readFileSync(pkgFile, 'utf8')));
      return import(pathToFileURL(path.join(pkgDir, entry)).href);
    }
    if (path.dirname(dir) === dir) return null;
  }
}

async function loadDeps() {
  const [pw, pm, png] = await Promise.all(['playwright', 'pixelmatch', 'pngjs'].map(loadFromProject));
  const missing = [[pw, 'playwright'], [pm, 'pixelmatch'], [png, 'pngjs']].filter(([m]) => !m).map(([, n]) => n);
  if (missing.length) {
    fail(`Missing packages in this project: ${missing.join(', ')}\n` +
      'Install them (ask the user first):\n  npm i -D playwright pixelmatch pngjs && npx playwright install chromium');
  }
  return {
    chromium: pw.chromium ?? pw.default?.chromium,
    pixelmatch: pm.default ?? pm,
    PNG: png.PNG ?? png.default?.PNG,
  };
}

async function capture(chromium, opts, width, height) {
  const target = opts.page ?? `${opts.url.replace(/\/$/, '')}/iframe.html?id=${encodeURIComponent(opts.story)}&viewMode=story`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: opts.scale });
    await page.goto(target, { waitUntil: 'networkidle' });
    await page.addStyleTag({
      content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
    });
    if (opts.story) await page.waitForSelector('#storybook-root > *, #root > *', { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    const shooter = opts.selector ? page.locator(opts.selector).first() : page;
    return await shooter.screenshot({ animations: 'disabled' });
  } finally {
    await browser.close();
  }
}

function crop(PNG, img, width, height) {
  if (img.width === width && img.height === height) return img;
  const out = new PNG({ width, height });
  PNG.bitblt(img, out, 0, 0, width, height, 0, 0);
  return out;
}

function hotspots(diff, width, height, scale) {
  const cellW = Math.ceil(width / GRID);
  const cellH = Math.ceil(height / GRID);
  const cells = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const x0 = gx * cellW, y0 = gy * cellH;
      const x1 = Math.min(x0 + cellW, width), y1 = Math.min(y0 + cellH, height);
      let bad = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          if (diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0) bad++;
        }
      }
      const area = (x1 - x0) * (y1 - y0);
      if (bad && area) cells.push({ x0, y0, x1, y1, pct: (bad / area) * 100 });
    }
  }
  return cells
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)
    .map(c => `  x ${Math.round(c.x0 / scale)}-${Math.round(c.x1 / scale)}, y ${Math.round(c.y0 / scale)}-${Math.round(c.y1 / scale)} (CSS px): ${c.pct.toFixed(1)}% differs`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.ref)) fail(`Reference image not found: ${opts.ref}`);
  const { chromium, pixelmatch, PNG } = await loadDeps();

  const reference = PNG.sync.read(fs.readFileSync(opts.ref));
  const viewW = Math.round(reference.width / opts.scale);
  const viewH = Math.round(reference.height / opts.scale);

  let actual;
  try {
    actual = PNG.sync.read(await capture(chromium, opts, viewW, viewH));
  } catch (err) {
    fail(`Could not render the target. Is Storybook running at ${opts.url}?\n${err.message}`);
  }

  const notes = [];
  if (actual.width !== reference.width || actual.height !== reference.height) {
    notes.push(`Size differs: rendered ${actual.width}x${actual.height}px, reference ${reference.width}x${reference.height}px. ` +
      'Compared the overlapping area only; the size difference is itself a fidelity issue.');
  }
  const width = Math.min(actual.width, reference.width);
  const height = Math.min(actual.height, reference.height);
  const ref = crop(PNG, reference, width, height);
  const act = crop(PNG, actual, width, height);
  const diff = new PNG({ width, height });
  const bad = pixelmatch(ref.data, act.data, diff.data, width, height, {
    threshold: opts.threshold,
    includeAA: false,
    diffColor: [255, 0, 0],
    aaColor: [255, 255, 0],
  });
  const pct = (bad / (width * height)) * 100;

  const name = (opts.story ?? path.basename(opts.ref, '.png')).replace(/[^a-z0-9-]+/gi, '_');
  fs.mkdirSync(opts.out, { recursive: true });
  const actualFile = path.join(opts.out, `${name}.actual.png`);
  const diffFile = path.join(opts.out, `${name}.diff.png`);
  fs.writeFileSync(actualFile, PNG.sync.write(actual));
  fs.writeFileSync(diffFile, PNG.sync.write(diff));

  const passed = pct <= opts.maxMismatch && notes.length === 0;
  console.log([
    `${passed ? 'PASS' : 'FAIL'}: ${pct.toFixed(2)}% of pixels differ (limit ${opts.maxMismatch}%)`,
    ...notes,
    ...(bad ? ['Regions with the most differences:', ...hotspots(diff, width, height, opts.scale)] : []),
    `Rendered: ${actualFile}`,
    `Diff (red = different): ${diffFile}`,
  ].join('\n'));
  process.exit(passed ? 0 : 1);
}

main();
