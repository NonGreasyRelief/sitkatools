#!/usr/bin/env node
// SitkaTools browser tests — run every tests/*.test.mjs (or those whose name contains the filter):
//
//   node tests/run.mjs [filter]
//
// Serves this folder on 127.0.0.1 (like GitHub Pages: one origin for every tool), starts a headless Firefox with a
// throw-away profile, and drives it over WebDriver BiDi — real clicks, real pen strokes on the initials pad, real
// right-click save links. Needs Node 22+ and Firefox (set FIREFOX=/path/to/firefox if it isn't on the PATH).
// No npm packages. The tests use a made-up database (tests/lib/helpers.mjs) and never touch real DB files.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connect } from './lib/bidi.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const filter = process.argv[2] || '';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
    '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.css': 'text/css' };

// ---- Static server ----
const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ---- Headless Firefox ----
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sitka-tests-'));
const port = 9300 + Math.floor(Math.random() * 600);
const ff = spawn(process.env.FIREFOX || 'firefox', ['--headless', '--no-remote', '--profile', profile, '--remote-debugging-port', String(port), 'about:blank'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const onData = d => { buf += d; const m = /WebDriver BiDi listening on (ws:\/\/\S+)/.exec(buf); if (m) resolve(m[1]); };
    ff.stdout.on('data', onData);
    ff.stderr.on('data', onData);
    ff.on('error', reject);
    setTimeout(() => reject(new Error('Firefox did not start (is it installed? set FIREFOX=…)')), 20000);
});

let failed = 0, passed = 0;
const b = await connect(`${wsUrl}/session`);
try {
    const files = fs.readdirSync(HERE).filter(f => f.endsWith('.test.mjs') && f.includes(filter)).sort();
    for (const f of files) {
        const mod = await import(pathToFileURL(path.join(HERE, f)).href);
        console.log(`\n▶ ${f} — ${mod.title || ''}`);
        const before = b.logs.length;
        let results = [];
        try {
            results = await mod.run(b, BASE);
        } catch (err) {
            results.push({ name: 'test ran to the end', ok: false });
            console.log(`  FAIL  test ran to the end  — ${err.stack}`);
        }
        const errors = b.logs.slice(before).filter(l => l.startsWith('[error]') || l.startsWith('[javascript'));
        if (errors.length) console.log('  page errors:\n    ' + errors.join('\n    '));
        passed += results.filter(r => r.ok).length;
        failed += results.filter(r => !r.ok).length;
    }
} finally {
    await b.close();
    ff.kill();
    server.close();
    await new Promise(r => setTimeout(r, 300));
    fs.rmSync(profile, { recursive: true, force: true });
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
