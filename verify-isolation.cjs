// Trigger fxIsolation directly + capture phases.
const fs = require('fs'); const http = require('http'); const path = require('path');
const { chromium } = require('/Users/yuliang_guo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = __dirname;
const outDir = path.join(root, 'verify-isolation');
fs.mkdirSync(outDir, { recursive: true });
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.mp3':'audio/mpeg' };
const server = http.createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(p==='/')p='/index.html';
  const f=path.resolve(path.join(root,p.slice(1)));
  if(!fs.existsSync(f)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
(async()=>{
  await new Promise(r=>server.listen(8149,'127.0.0.1',r));
  const b=await chromium.launch({headless:true,executablePath:'/Users/yuliang_guo/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-131.0.6778.85/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
  const ctx=await b.newContext({viewport:{width:1920,height:1080}});
  const p=await ctx.newPage();
  p.on('pageerror',e=>console.log('[ERR]',e.message));
  await p.goto('http://127.0.0.1:8149/index.html',{waitUntil:'networkidle'});
  await p.click('#overlay');
  await p.evaluate(()=>{const a=document.getElementById('song');if(a){a.muted=true;a.pause();}});
  await p.waitForTimeout(500);
  // simulate the showIsolation trigger
  const t0 = await p.evaluate(()=>{ showIsolation(); return performance.now(); });
  const phases = [
    { dt: 80,  name: 'iso-01-you-burst.png' },
    { dt: 250, name: 'iso-02-you-drift.png' },
    { dt: 450, name: 'iso-03-vignette.png' },
    { dt: 650, name: 'iso-04-me-rev.png' },
    { dt: 850, name: 'iso-05-locked.png' },
  ];
  for (const c of phases) {
    const elapsed = (await p.evaluate(()=>performance.now())) - t0;
    if (elapsed < c.dt) await p.waitForTimeout(c.dt - elapsed);
    await p.screenshot({path:path.join(outDir,c.name)});
    console.log(`captured ${c.name} at +${c.dt}ms`);
  }
  await b.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
