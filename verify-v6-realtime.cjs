// Real 1x speed finale verification
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('/Users/yuliang_guo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = __dirname;
const outDir = path.join(root, 'verify-v6');
fs.mkdirSync(outDir, { recursive: true });

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const target = path.resolve(path.join(root, urlPath.slice(1)));
  if (!fs.existsSync(target)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(8137, '127.0.0.1', r));
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/yuliang_guo/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-131.0.6778.85/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8137/index.html', { waitUntil: 'networkidle' });
  await page.click('#overlay');

  // Real-time, muted
  await page.evaluate(() => {
    const a = document.getElementById('song');
    if (a) { a.muted = true; }
  });

  // Just wait for song.currentTime to reach our targets at real-time pace.
  const moments = [
    { t: 188.7,  name: 'd2-third-love-theorem-just-after-clear' },
    { t: 195.0,  name: 'e2-third-love-theorem-still-visible' },
    { t: 200.0,  name: 'f2-third-love-theorem-into-trapped' },
    { t: 206.05, name: 'g2-final-hero-fade-in' },
    { t: 206.6,  name: 'h2-final-runtime-printing' },
    { t: 207.2,  name: 'i2-final-runtime-full' },
    { t: 207.6,  name: 'j2-final-dissolve-into-ash' },
    { t: 208.2,  name: 'k2-final-heart-pulse' },
    { t: 208.5,  name: 'l2-final-heart-and-coda' },
  ];

  for (const m of moments) {
    await page.waitForFunction((target) => {
      const a = document.getElementById('song');
      return a && a.currentTime >= target;
    }, m.t, { timeout: 250000 });
    await page.screenshot({ path: path.join(outDir, `${m.name}.png`) });
    console.log(`captured ${m.name} at t≈${m.t}`);
  }

  await browser.close();
  server.close();
})().catch((err) => { console.error(err); server.close(); process.exit(1); });
