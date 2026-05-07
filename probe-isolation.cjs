const fs=require('fs');const http=require('http');const path=require('path');
const{chromium}=require('/Users/yuliang_guo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=__dirname;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);if(p==='/')p='/index.html';const f=path.resolve(path.join(root,p.slice(1)));if(!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(8150,'127.0.0.1',r));
  const b=await chromium.launch({headless:true,executablePath:'/Users/yuliang_guo/.cache/hyperframes/chrome/chrome-headless-shell/mac_arm-131.0.6778.85/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
  const ctx=await b.newContext({viewport:{width:1920,height:1080}});
  const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8150/index.html',{waitUntil:'networkidle'});
  await p.click('#overlay');
  await p.evaluate(()=>{const a=document.getElementById('song');if(a){a.muted=true;a.pause();}});
  await p.waitForTimeout(400);
  await p.evaluate(()=>{ showIsolation(); });
  await p.waitForTimeout(120);
  const dump=await p.evaluate(()=>{
    const r={};
    const overlay=document.querySelector('.kfx-isolation');
    if(!overlay){r.overlay='MISSING';return r;}
    r.overlay={pos:getComputedStyle(overlay).position,z:getComputedStyle(overlay).zIndex,inset:getComputedStyle(overlay).inset,opacity:getComputedStyle(overlay).opacity,bg:getComputedStyle(overlay).backgroundImage.slice(0,80),children:overlay.children.length,parent:overlay.parentElement?overlay.parentElement.tagName+'#'+overlay.parentElement.id:''};
    const yous=overlay.querySelectorAll('.iso-you');
    r.youCount=yous.length;
    if(yous.length){const y=yous[0];const cs=getComputedStyle(y);r.firstYou={text:y.textContent,top:cs.top,left:cs.left,opacity:cs.opacity,color:cs.color,zIndex:cs.zIndex};}
    const me=overlay.querySelector('.iso-me');
    if(me){const cs=getComputedStyle(me);r.me={text:me.textContent,opacity:cs.opacity,color:cs.color,fontSize:cs.fontSize};}
    const ring=overlay.querySelector('.iso-ring');
    if(ring){const cs=getComputedStyle(ring);r.ring={opacity:cs.opacity,border:cs.border,w:cs.width};}
    return r;
  });
  console.log(JSON.stringify(dump,null,2));
  await p.waitForTimeout(700);
  await p.screenshot({path:path.join(root,'verify-isolation','iso-probe.png')});
  await b.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
