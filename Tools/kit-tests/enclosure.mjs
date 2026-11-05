import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch();const page=await browser.newPage();
try{
 await page.goto(pathToFileURL(resolve('Prototypes/DungeonWalk/index.html')).href);await page.waitForFunction(()=>window.KIT_TEST);
 const dimensions=await page.evaluate(()=>({gate:KIT_TEST.geometry.gate,wall:KIT.walls}));
 assert.equal(dimensions.gate.height,dimensions.wall.height+dimensions.wall.thickness,'entrance must have the same projected height as the surrounding wall, not a tall tower');
 assert(dimensions.wall.corner_radius>=8,'soft-fantasy corners need an actual rounded silhouette');
 const states=[];
 for(const layout of ['hall','elbow','puzzle'])for(const open of [false,true]){
  await page.locator('#layout').selectOption(layout);if(open)await page.locator('#door').click();await page.waitForTimeout(60);
  const result=await page.evaluate(()=>{
   const c=document.querySelector('#stage'),cx=c.getContext('2d'),original=cx.drawImage,fill=cx.fillRect;
   const accepted=new Set(['wall_cap','wall_face','door_open','door_closed'].map(id=>KIT_TEST.images[id]));
   cx.drawImage=function(img,...args){if(accepted.has(img))original.call(this,img,...args);};cx.fillRect=()=>{};draw();
   const first=(x)=>{const a=cx.getImageData(x,0,1,400).data;for(let y=0;y<400;y++)if(a[y*4+3]>128)return y;return null;};
   const gate=KIT_TEST.geometry.gate;
   const x=100-KIT.walls.thickness/2,y=196-KIT.walls.height-KIT.walls.thickness/2;
   const outside=cx.getImageData(x+1,y+1,1,1).data[3],inside=cx.getImageData(x+12,y+12,1,1).data[3];
   const tops={wall:first(280),gate:first(100+(gate.start+gate.end)*32),roundedOutsideAlpha:outside,roundedInsideAlpha:inside};
   cx.drawImage=original;cx.fillRect=fill;draw();return tops;
  });
  assert(Math.abs(result.wall-result.gate)<=2,JSON.stringify(result));
  assert(result.roundedOutsideAlpha<20&&result.roundedInsideAlpha>240,'rounded corner must be visible in the rendered silhouette');
  await page.locator('#stage').screenshot({path:`Prototypes/DungeonWalk/Validation/enclosed-${layout}-${open?'open':'closed'}.png`});
  states.push({layout,open,...result});
 }
 await writeFile('Prototypes/DungeonWalk/Validation/enclosure-report.json',JSON.stringify({status:'passed',checks:['same wall/gate top line','rounded contour geometry','three enclosed layouts in both gate states'],states},null,2)+'\n');
 console.log('Soft enclosure proportions and top lines passed');
}finally{await browser.close();}
