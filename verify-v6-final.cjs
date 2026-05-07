// Focused re-verify for the finale + reboot banner after the v5-love-stage cleanup fix.
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
  await new Promise((r) => server.listen(8134, '127.0.0.1', r));
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/yuliang_guo/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-131.0.6778.85/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (err) => { errors.push(err.message); console.log('PAGE_PAGEERROR:', err.message); });
  await page.goto('http://127.0.0.1:8134/index.html', { waitUntil: 'networkidle' });
  await page.click('#overlay');

  // Speed up song 4× to reach finale moments quickly without breaking event ordering.
  await page.evaluate(() => {
    const a = document.getElementById('song');
    if (a) { a.playbackRate = 4; a.muted = true; }
  });

  const moments = [
    { t: 146.8, name: 'jj-reboot-runtime-banner-fixed' },
    { t: 205.95, name: 'kk-final-hero-zoom-clean' },
    { t: 207.10, name: 'mm-final-cracks-shards-clean' },
    { t: 207.70, name: 'nn-final-implosion-flash-clean' },
    { t: 208.10, name: 'oo-final-epitaph-clean' },
  ];

  for (const m of moments) {
    await page.waitForFunction((target) => {
      const a = document.getElementById('song');
      return a && a.currentTime >= target;
    }, m.t, { timeout: 90000 });
    await page.screenshot({ path: path.join(outDir, `${m.name}.png`) });
    console.log(`captured ${m.name} at t≈${m.t}`);
  }

  await browser.close();
  server.close();
  console.log(errors.length === 0 ? 'NO_PAGE_ERRORS' : `PAGE_ERRORS:${errors.length}`);
})().catch((err) => { console.error(err); server.close(); process.exit(1); });
