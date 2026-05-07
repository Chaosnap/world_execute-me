// Verify v6.1 LRC retiming: capture lyric line states at key audio timestamps.
// Each capture is taken at the EXACT LRC time of a lyric line, so we can confirm
// that the typed text is on screen (and the previous line/emphasis has cleared).
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('/Users/yuliang_guo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = __dirname;
const outDir = path.join(root, 'verify-v6-1-lrc');
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
  await new Promise((r) => server.listen(8143, '127.0.0.1', r));
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/yuliang_guo/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-131.0.6778.85/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => console.log('[PAGE_ERROR]', err.message));
  await page.goto('http://127.0.0.1:8143/index.html', { waitUntil: 'networkidle' });
  await page.click('#overlay');
  await page.evaluate(() => { const a=document.getElementById('song'); if(a){a.muted=true;} });

  // sample a handful of critical points to check sync
  const captures = [
    // Each (at, name, expectLine[]) - expect to see these substrings as latest visible lyric lines
    { at: 1.10,  name: 'lrc-001-power.png',     expect: ['power line'] },
    { at: 3.40,  name: 'lrc-002-protection.png',expect: ['Remember to put on', 'PROTECTION'] },
    { at: 13.60, name: 'lrc-003-simulation.png',expect: ["And let's begin", 'SIMULATION'] },
    { at: 36.50, name: 'lrc-004-circumf.png',   expect: ['CIRCUMFERENCE'] },
    { at: 49.30, name: 'lrc-005-dizzy.png',     expect: ['So dizzy'] },
    { at: 61.50, name: 'lrc-006-stim.png',      expect: ['STIMULATIONS'] },
    { at: 80.60, name: 'lrc-007-antiox.png',    expect: ['ANTIOXIDANTS'] },
    { at: 102.50,name: 'lrc-008-trance.png',    expect: ['trance'] },
    { at: 117.40,name: 'lrc-009-isolation.png', expect: ['ISOLATION'] },
    { at: 132.00,name: 'lrc-010-illegal.png',   expect: ['ILLEGAL ARGUMENTS'] },
    { at: 134.50,name: 'lrc-011-bsod.png',      expect: ['ILLEGAL_ARGUMENT_EXCEPTION'] },
    { at: 145.00,name: 'lrc-012-reboot.png',    expect: [] },
    { at: 153.00,name: 'lrc-013-execspam.png',  expect: [] },
    { at: 161.50,name: 'lrc-014-chaos.png',     expect: ['EXECUTION'] },
    { at: 187.50,name: 'lrc-015-love3.png',     expect: ['L O-O-O V E'] },
    { at: 192.00,name: 'lrc-016-trapped.png',   expect: ['Trapped'] },
  ];

  await page.evaluate(() => { const a=document.getElementById('song'); if(a){ a.playbackRate = 6; } });

  const report = [];
  for (const c of captures) {
    await page.waitForFunction((t) => { const a=document.getElementById('song'); return a && a.currentTime >= t - 0.6; }, c.at, { timeout: 90000 });
    await page.evaluate(() => { const a=document.getElementById('song'); if(a){ a.playbackRate = 1; } });
    await page.waitForFunction((t) => { const a=document.getElementById('song'); return a && a.currentTime >= t; }, c.at, { timeout: 60000 });
    await page.screenshot({ path: path.join(outDir, c.name), fullPage: false });

    const visibleText = await page.evaluate(() => {
      const visuals = document.getElementById('visuals');
      const bsod = document.getElementById('bsod-screen');
      const reboot = document.getElementById('reboot-screen');
      return {
        visuals: visuals ? visuals.innerText : '',
        bsod: bsod ? bsod.innerText.slice(0, 200) : '',
        reboot: reboot ? reboot.innerText.slice(0, 80) : '',
      };
    });
    const allText = visibleText.visuals + ' | BSOD:' + visibleText.bsod + ' | RB:' + visibleText.reboot;
    const missing = c.expect.filter(s => !allText.toUpperCase().includes(s.toUpperCase()));
    const ok = missing.length === 0;
    report.push({ at: c.at, name: c.name, ok, missing, snippet: allText.replace(/\s+/g, ' ').slice(0, 160) });
    console.log(`${ok ? 'OK ' : 'FAIL'} @${c.at}s ${c.name} | missing=${JSON.stringify(missing)} | text="${allText.replace(/\s+/g, ' ').slice(0, 100)}"`);

    await page.evaluate(() => { const a=document.getElementById('song'); if(a){ a.playbackRate = 6; } });
  }

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
  const fails = report.filter(r => !r.ok);
  console.log(`\n=== ${report.length - fails.length}/${report.length} passed ===`);
  if (fails.length) { console.log('failures:', fails.map(f => `${f.at}s:${f.missing}`).join(', ')); }
})().catch(e => { console.error(e); process.exit(1); });
