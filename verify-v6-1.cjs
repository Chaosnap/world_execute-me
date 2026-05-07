// Verify V6.1 fixes: full-bleed BSOD, me@world prompt, adaptive typing.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('/Users/yuliang_guo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = __dirname;
const outDir = path.join(root, 'verify-v6-1');
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
  await new Promise((r) => server.listen(8141, '127.0.0.1', r));
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/yuliang_guo/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-131.0.6778.85/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => console.log('[PAGE_ERROR]', err.message));
  await page.goto('http://127.0.0.1:8141/index.html', { waitUntil: 'networkidle' });
  await page.click('#overlay');

  await page.evaluate(() => {
    const a = document.getElementById('song');
    if (a) { a.muted = true; }
  });

  const captures = [
    { at: 4.0, name: '01-prompt-early.png',     note: 'check me@world prompt' },
    { at: 12.0, name: '02-prompt-typing.png',   note: 'check typing finished' },
    { at: 60.5, name: '03-stim-line.png',       note: 'pre stim emphasis' },
    { at: 126.5, name: '04-sudo-prompt.png',    note: 'check me@world:~# (root)' },
    { at: 135.0, name: '05-bsod-fullbleed.png', note: 'BSOD must cover all sides incl. crt strips' },
    { at: 138.5, name: '06-bsod-mid.png',       note: 'BSOD still full bleed' },
  ];

  // Run at high speed then slow at each capture
  await page.evaluate(() => {
    const a = document.getElementById('song');
    if (a) a.playbackRate = 6;
  });

  for (const c of captures) {
    // wait until just before capture point
    await page.waitForFunction((t) => {
      const a = document.getElementById('song');
      return a && a.currentTime >= t - 0.5;
    }, c.at, { timeout: 60000 });

    // slow down for accurate frame
    await page.evaluate(() => {
      const a = document.getElementById('song');
      if (a) a.playbackRate = 1;
    });

    await page.waitForFunction((t) => {
      const a = document.getElementById('song');
      return a && a.currentTime >= t;
    }, c.at, { timeout: 60000 });

    await page.screenshot({ path: path.join(outDir, c.name), fullPage: false });
    console.log(`captured ${c.name} @${c.at}s — ${c.note}`);

    // speed back up
    await page.evaluate(() => {
      const a = document.getElementById('song');
      if (a) a.playbackRate = 6;
    });
  }

  await browser.close();
  server.close();
  console.log('done -> ' + outDir);
})().catch((e) => { console.error(e); process.exit(1); });
