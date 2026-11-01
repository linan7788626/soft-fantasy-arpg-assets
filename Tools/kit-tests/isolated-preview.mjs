import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
// Reproduce a preview host that can serve this page's folder, but not ../../Assets.
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://local').pathname;const name=path==='/'?'index.html':path.slice(1);if(!['index.html','kit-data.js','preview.js'].includes(name)){res.writeHead(404).end();return;}try{res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile('Prototypes/DungeonWalk/'+name));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch();try{const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForTimeout(1000);const status=await page.locator('#status').textContent();assert(await page.evaluate(()=>!!window.KIT_TEST),status);assert.equal(await page.evaluate(()=>Object.keys(KIT_TEST.images).length),9);
await mkdir('Prototypes/DungeonWalk/Validation',{recursive:true});
await page.locator('#stage').screenshot({path:'Prototypes/DungeonWalk/Validation/standalone-host.png'});
await writeFile('Prototypes/DungeonWalk/Validation/standalone-report.json',JSON.stringify({status:'passed',scenario:'Only preview files hosted; no Assets directory',loadedImages:9},null,2)+'\n');
console.log('Preview-only hosting displays all9 sprites');}finally{await browser.close();await new Promise(r=>server.close(r));}
