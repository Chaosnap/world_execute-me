const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('/Users/yuliang_guo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = __dirname;
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
  await new Promise(r=>server.listen(8147,'127.0.0.1',r));
  const b=await chromium.launch({headless:true,executablePath:'/Users/yuliang_guo/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-131.0.6778.85/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
  const ctx=await b.newContext({viewport:{width:1920,height:1080}});
  const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8147/index.html',{waitUntil:'networkidle'});
  await p.click('#overlay');
  await p.evaluate(()=>{const a=document.getElementById('song'); if(a){a.muted=true;a.pause();}});
  await p.waitForTimeout(500);
  await p.evaluate(()=>{ uniteEffect(); });
  await p.waitForTimeout(700);
  const dump=await p.evaluate(()=>{
    const ids=['.v61-unite-stage','.ust-stream.left','.ust-stream.right','.ust-flash','.ust-sigil','.ust-ring','.ust-well','.ust-deeply','#container'];
    const r={};
    for(const sel of ids){
      const el=document.querySelector(sel);
      if(!el){r[sel]={missing:true};continue;}
      const cs=getComputedStyle(el);
      const re=el.getBoundingClientRect();
      r[sel]={pos:cs.position,top:cs.top,left:cs.left,w:cs.width,h:cs.height,inset:cs.inset,rect:{x:re.x,y:re.y,w:re.width,h:re.height},opacity:cs.opacity,parent:el.parentElement?(el.parentElement.tagName+'#'+el.parentElement.id):''};
    }
    return r;
  });
  console.log(JSON.stringify(dump,null,2));
  await b.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
