// Captures finale at 1× speed for accurate animation timing
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
  await new Promise((r) => server.listen(8136, '127.0.0.1', r));
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/yuliang_guo/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-131.0.6778.85/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8136/index.html', { waitUntil: 'networkidle' });
  await page.click('#overlay');

  // Speed to ~204.5s, then drop to 1× for the finale
  await page.evaluate(() => {
    const a = document.getElementById('song');
    if (a) { a.playbackRate = 8; a.muted = true; }
  });

  await page.waitForFunction(() => {
    const a = document.getElementById('song');
    return a && a.currentTime >= 204.0;
  }, null, { timeout: 90000 });

  // Drop to 1× for accurate finale timing
  await page.evaluate(() => {
    const a = document.getElementById('song');
    if (a) { a.playbackRate = 1; }
  });

  // finalExecution fires at 205.811. Capture at:
  //  - 206.4 (~0.6s after = runtime fading in, 1 row)
  //  - 207.0 (~1.2s after = runtime r3 visible)
  //  - 207.4 (~1.6s after = dissolve started)
  //  - 208.0 (~2.2s after = heart appearing)
  //  - 208.5 (~2.7s after = coda visible)
  const moments = [
    { t: 206.4, name: 'final-1-runtime-printing' },
    { t: 207.0, name: 'final-2-runtime-full' },
    { t: 207.4, name: 'final-3-dissolve-start' },
    { t: 208.0, name: 'final-4-heart-appearing' },
    { t: 208.5, name: 'final-5-heart-and-coda' },
  ];

  for (const m of moments) {
    await page.waitForFunction((target) => {
      const a = document.getElementById('song');
      return a && a.currentTime >= target;
    }, m.t, { timeout: 30000 });
    await page.screenshot({ path: path.join(outDir, `${m.name}.png`) });
    console.log(`captured ${m.name} at t≈${m.t}`);
  }

  await browser.close();
  server.close();
})().catch((err) => { console.error(err); server.close(); process.exit(1); });
