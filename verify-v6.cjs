const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('/Users/yuliang_guo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = __dirname;
const outDir = path.join(root, 'verify-v6');
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mp3': 'audio/mpeg',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const target = path.resolve(path.join(root, urlPath.slice(1)));
  if (!fs.existsSync(target)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(8133, '127.0.0.1', r));
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/yuliang_guo/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-131.0.6778.85/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (err) => { errors.push(err.message); console.log('PAGE_PAGEERROR:', err.message); });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE_ERROR:', msg.text());
  });
  await page.goto('http://127.0.0.1:8133/index.html', { waitUntil: 'networkidle' });
  await page.click('#overlay');

  // Issue 5: trance lyric visible at 102.5 (should still be there now)
  // Issue 1: new fragments animation 120.8..122.8
  // Issue 6: ILLEGAL ARGUMENTS red 131.5..133.0
  // Issue 7: new reboot screen 144..147
  // Issue 8: new finale 205.9..208.0
  const moments = [
    { t: 102.6, name: 'a-trance-still-visible' },
    { t: 103.7, name: 'b-after-trance-clear' },
    { t: 121.0, name: 'c-fragments-new-shards' },
    { t: 121.7, name: 'd-fragments-mid-collapse' },
    { t: 122.4, name: 'e-fragments-null' },
    { t: 131.6, name: 'f-illegal-args-red' },
    { t: 132.8, name: 'g-illegal-args-still-red' },
    { t: 144.0, name: 'h-reboot-hardware' },
    { t: 145.5, name: 'i-reboot-kernel-decompress' },
    { t: 146.8, name: 'j-reboot-runtime-banner' },
    { t: 205.95, name: 'k-final-hero-zoom' },
    { t: 206.50, name: 'l-final-call-line' },
    { t: 207.10, name: 'm-final-cracks-shards' },
    { t: 207.70, name: 'n-final-implosion-flash' },
    { t: 208.10, name: 'o-final-epitaph' },
  ];

  for (const m of moments) {
    await page.waitForFunction((target) => {
      const a = document.getElementById('song');
      return a && a.currentTime >= target;
    }, m.t, { timeout: 240000 });
    await page.screenshot({ path: path.join(outDir, `${m.name}.png`) });
    console.log(`captured ${m.name} at t≈${m.t}`);
  }

  // Issue 3: pause/resume test — pause once, capture, resume, capture
  // Wait until ~150s in spam region, then send P
  await page.waitForFunction(() => {
    const a = document.getElementById('song');
    return a && a.currentTime >= 150;
  }, null, { timeout: 60000 }).catch(() => {});
  // (We're already past it from the moments loop end at 208, so skip pause test there.)
  // Reload and try pause earlier in song:
  await browser.close();

  // Second run dedicated to pause test
  const browser2 = await chromium.launch({
    headless: true,
    executablePath: '/Users/yuliang_guo/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-131.0.6778.85/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const ctx2 = await browser2.newContext({ viewport: { width: 1920, height: 1080 } });
  const page2 = await ctx2.newPage();
  page2.on('pageerror', (err) => { errors.push(err.message); console.log('PAGE_PAGEERROR(2):', err.message); });
  await page2.goto('http://127.0.0.1:8133/index.html', { waitUntil: 'networkidle' });
  await page2.click('#overlay');
  await page2.waitForFunction(() => {
    const a = document.getElementById('song');
    return a && a.currentTime >= 30;
  }, null, { timeout: 60000 });
  await page2.keyboard.press('p');
  await page2.waitForTimeout(600);
  await page2.screenshot({ path: path.join(outDir, 'p-paused-overlay.png') });
  await page2.keyboard.press('p');
  await page2.waitForTimeout(800);
  await page2.screenshot({ path: path.join(outDir, 'q-resumed.png') });

  await browser2.close();
  server.close();

  console.log(errors.length === 0 ? 'NO_PAGE_ERRORS' : `PAGE_ERRORS:${errors.length}`);
})().catch((err) => {
  console.error(err);
  server.close();
  process.exit(1);
});
