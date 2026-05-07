// V6.4 verify — captures the 5 latest feedback fixes:
// 1) STIMULATIONS neural simulation (~63s)
// 2) trance overlay (no rotating rectangle, breathing pulse) (~102.5s)
// 3) BSOD with side margins (~135s)
// 4) third LOVE THEOREM panel persisting through trapped sequence (~192s, ~200s)
// 5) final EXECUTION redesigned (~206s, ~207s, ~208s)
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
  await new Promise((r) => server.listen(8135, '127.0.0.1', r));
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/yuliang_guo/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-131.0.6778.85/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (err) => { errors.push(err.message); console.log('PAGE_PAGEERROR:', err.message); });
  await page.goto('http://127.0.0.1:8135/index.html', { waitUntil: 'networkidle' });
  await page.click('#overlay');

  // 4× speed (muted) so we don't sit through 3+ minutes of audio.
  await page.evaluate(() => {
    const a = document.getElementById('song');
    if (a) { a.playbackRate = 4; a.muted = true; }
  });

  const moments = [
    { t: 63.5,   name: 'a-stimulations-neural-cascade' },
    { t: 102.6,  name: 'b-trance-breathing-overlay' },
    { t: 135.0,  name: 'c-bsod-with-margins' },
    { t: 188.7,  name: 'd-third-love-theorem-just-after-clear' },
    { t: 195.0,  name: 'e-third-love-theorem-still-visible' },
    { t: 200.0,  name: 'f-third-love-theorem-into-trapped' },
    { t: 206.05, name: 'g-final-hero-fade-in' },
    { t: 207.10, name: 'h-final-runtime-block-printing' },
    { t: 207.85, name: 'i-final-hero-dissolving-into-ash' },
    { t: 208.30, name: 'j-final-heart-and-coda' },
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
