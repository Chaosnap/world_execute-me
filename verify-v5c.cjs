const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('/Users/yuliang_guo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = __dirname;
const outDir = path.join(root, 'verify-v5c');
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
  await new Promise((r) => server.listen(8132, '127.0.0.1', r));
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/yuliang_guo/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-131.0.6778.85/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => console.log('PAGE_PAGEERROR:', err.message));
  await page.goto('http://127.0.0.1:8132/index.html', { waitUntil: 'networkidle' });
  await page.click('#overlay');

  const moments = [
    { t: 121.4, name: 'a-frag-broom-start' },
    { t: 122.0, name: 'b-frag-broom-mid' },
    { t: 122.7, name: 'c-frag-stamp' },
    { t: 159.0, name: 'd-lang-1' },
    { t: 159.7, name: 'e-lang-3' },
    { t: 160.5, name: 'f-lang-5' },
    { t: 161.2, name: 'g-lang-6' },
    { t: 161.9, name: 'h-lang-fading' },
    { t: 70.2, name: 'i-execution-pids-fixed' },
  ];

  for (const m of moments) {
    await page.waitForFunction((target) => {
      const a = document.getElementById('song');
      return a && a.currentTime >= target;
    }, m.t, { timeout: 200000 });
    await page.screenshot({ path: path.join(outDir, `${m.name}.png`) });
    console.log(`captured ${m.name} at t≈${m.t}`);
  }

  await browser.close();
  server.close();
})().catch((err) => {
  console.error(err);
  server.close();
  process.exit(1);
});
