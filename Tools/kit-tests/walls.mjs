// Reproduce the user's wall-cap discontinuity in the actual Canvas renderer.
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
const page=await browser.newPage();
const out=process.env.NLI_WALL_OUT||'Prototypes/DungeonWalk/Validation';await mkdir(out,{recursive:true});
try{
 await page.goto(pathToFileURL(resolve(process.env.NLI_PREVIEW_HTML||'Prototypes/DungeonWalk/index.html')).href);
 await page.waitForFunction(()=>window.KIT_TEST);
 const failures=[];let probeCount=0;
 for(const layout of ['hall','elbow','puzzle']){
  await page.locator('#layout').selectOption(layout);
  const result=await page.evaluate(testLayout=>{
   const c=document.querySelector('#stage'),context=c.getContext('2d');
   const original=context.drawImage,fill=context.fillRect;
   const walls=new Set(['wall','sidewall','pillar'].map(id=>KIT_TEST.images[id]));
   context.drawImage=function(img,...args){if(walls.has(img))original.call(this,img,...args);};
   context.fillRect=()=>{};
   draw();
   const probes=[];
   // Cap plane must continue at uniform depth from a horizontal run into
   // both vertical runs; cream facade or empty space in these probes is a seam.
   const points=[['north',200,172],['north-west',104,172],['west',104,280],['east',864,280],['south-west',104,684],['south-east',testLayout==='elbow'?480:864,684]];
   const floor=(x,y)=>x>=0&&x<12&&y>=0&&y<8&&(testLayout!=='elbow'||x<6||y<4);
   for(let y=0;y<8;y++)for(let x=0;x<12;x++)if(floor(x,y)){
    for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]])if(!floor(x+dx,y+dy)&&!(dy===-1&&y===0&&x>=5&&x<8)){
     for(const offset of [-8,0,8])for(const along of [4,20,36,52,60]){
      const px=100+(dy?x*64+along:(x+(dx===1))*64+offset);
      const py=196-24+(dy?(y+(dy===1))*64+offset:y*64+along);
      points.push(['rim',px,py]);
     }
    }
   }
   for(const [name,x,y] of points){
    const rgba=Array.from(context.getImageData(x,y,1,1).data);
    const [r,g,b,a]=rgba;probes.push({name,x,y,rgba,passed:a>240&&b+15>=r});
   }
   const png=c.toDataURL();context.drawImage=original;context.fillRect=fill;draw();
   return {probes,png};
  },layout);
  await writeFile(`${out}/walls-${layout}.png`,Buffer.from(result.png.split(',')[1],'base64'));
  probeCount+=result.probes.length;
  failures.push(...result.probes.filter(p=>!p.passed).map(p=>({layout,...p})));
 }
 await writeFile(`${out}/wall-report.json`,JSON.stringify({status:failures.length?'failed':'passed',probeCount,failures},null,2)+'\n');
 assert.equal(failures.length,0,'wall-cap plane breaks at straight/corner joins; examples: '+JSON.stringify(failures.slice(0,6)));
 console.log('Wall-cap continuity passed in three layouts');
}finally{await browser.close();}
