const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('/Users/yuliang_guo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = __dirname;
const outDir = path.join(root, 'peek');
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
  await page.goto('http://127.0.0.1:8135/index.html', { waitUntil: 'networkidle' });
  await page.click('#overlay');
  await page.evaluate(() => {
    const a = document.getElementById('song');
    if (a) { a.playbackRate = 4; a.muted = true; }
  });

  const moments = [
    { t: 62.5, name: 'stim-mid' },
    { t: 63.5, name: 'stim-late' },
    { t: 106.5, name: 'vibe-emphasis' },
    { t: 107.0, name: 'vibe-rings' },
    { t: 107.6, name: 'vibe-late' },
    { t: 110.5, name: 'completion' },
    { t: 134.0, name: 'bsod-margin' },
    { t: 138.0, name: 'bsod-mid' },
    { t: 188.0, name: 'love3-theorem' },
    { t: 190.0, name: 'love3-fading-or-trapped' },
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
})().catch((err) => { console.error(err); server.close(); process.exit(1); });
