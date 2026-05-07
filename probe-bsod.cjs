const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('/Users/yuliang_guo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = __dirname;
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
  await new Promise((r) => server.listen(8142, '127.0.0.1', r));
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/yuliang_guo/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-131.0.6778.85/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8142/index.html', { waitUntil: 'networkidle' });
  await page.click('#overlay');
  await page.evaluate(() => { const a=document.getElementById('song'); if(a){a.muted=true; a.playbackRate=8;} });
  await page.waitForFunction(() => { const a=document.getElementById('song'); return a&&a.currentTime>=134.0; }, null, { timeout: 90000 });
  await page.evaluate(() => { const a=document.getElementById('song'); if(a){a.playbackRate=1;} });
  await page.waitForFunction(() => { const a=document.getElementById('song'); return a&&a.currentTime>=135.5; }, null, { timeout: 60000 });

  const dumpz = await page.evaluate(() => {
    const els = ['bsod-screen', 'amb-rain', 'binary-canvas', 'container', 'visuals'];
    const all = [];
    for (const id of els) {
      const el = document.getElementById(id);
      if (!el) { all.push({ id, missing: true }); continue; }
      const cs = getComputedStyle(el);
      all.push({
        id,
        z: cs.zIndex,
        pos: cs.position,
        bg: cs.backgroundColor,
        opacity: cs.opacity,
        mixBlend: cs.mixBlendMode,
        filter: cs.filter,
        rect: el.getBoundingClientRect(),
      });
    }
    const bodyClass = document.body.className;
    const allFixedAboveBSOD = [...document.querySelectorAll('*')]
      .filter(el => {
        const cs = getComputedStyle(el);
        return cs.position === 'fixed' && parseInt(cs.zIndex || '0', 10) > 50;
      })
      .map(el => ({ tag: el.tagName, id: el.id, cls: el.className, z: getComputedStyle(el).zIndex }));
    return { all, bodyClass, allFixedAboveBSOD };
  });
  console.log(JSON.stringify(dumpz, null, 2));
  await page.screenshot({ path: path.join(root, 'verify-v6-1', 'probe-bsod.png') });
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
