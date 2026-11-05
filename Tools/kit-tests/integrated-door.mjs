import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch();const page=await browser.newPage();
try{
 await page.goto(pathToFileURL(resolve('Prototypes/DungeonWalk/index.html')).href);await page.waitForFunction(()=>window.KIT_TEST);
 const result=await page.evaluate(()=>{
  const c=document.querySelector('#stage'),ctx=c.getContext('2d'),drawImage=ctx.drawImage,fill=ctx.fillRect;
  const material=new Set([KIT_TEST.images.wall_face,KIT_TEST.images.wall_cap]);
  ctx.drawImage=function(img,...args){if(material.has(img))drawImage.call(this,img,...args);};ctx.fillRect=()=>{};draw();
  const y=196-KIT.walls.height;
  const cap=[];for(let x=5*64+4;x<8*64;x+=8)cap.push(ctx.getImageData(100+x,y,1,1).data[3]);
  const opening=KIT.walls.gate.opening,rect=opening?.rect;
  const holeAlpha=rect?ctx.getImageData(100+rect[0]+rect[2]/2,196+rect[1]+rect[3]/2,1,1).data[3]:255;
  const jambAlpha=rect?ctx.getImageData(100+rect[0]-12,196+rect[1]+rect[3]/2,1,1).data[3]:0;
  ctx.drawImage=drawImage;ctx.fillRect=fill;draw();
  return{faceHeight:KIT.walls.height,integrated:KIT.walls.gate.integrated,capMinimumAlpha:Math.min(...cap),holeAlpha,jambAlpha};
 });
 assert(result.faceHeight>=104,'wall face should be visibly taller than the standing hero');
 assert.equal(result.integrated,true,'door must be a carved opening in the same wall, not a standalone frame');
 assert(result.capMinimumAlpha>240,'wall cap itself must continue across the entrance, even with the door artwork hidden');
 assert(result.holeAlpha<128&&result.jambAlpha>240,'the actual wall face must be carved out, with the same masonry remaining beside it');
 for(const x of [5.5,7.5]){
  await page.evaluate(x=>{KIT_TEST.setPlayer(x,1.5);KIT_TEST.move(0,-1);},x);
  assert.equal(await page.evaluate(()=>KIT_TEST.state.player.y),.5,'old standalone jamb collision must be removed');
  await page.evaluate(()=>KIT_TEST.move(0,-1));assert.equal(await page.evaluate(()=>KIT_TEST.state.player.y),.5);
 }
 await page.locator('#layout').selectOption('puzzle');
 const passage=await page.evaluate(()=>{
  KIT_TEST.setPlayer(7.5,3.5);KIT_TEST.move(1,0);
  const c=document.querySelector('#stage'),ctx=c.getContext('2d'),drawImage=ctx.drawImage,fill=ctx.fillRect;
  ctx.drawImage=function(img,...args){if(img===KIT_TEST.images.wall_face||img===KIT_TEST.images.wall_cap)drawImage.call(this,img,...args);};ctx.fillRect=()=>{};draw();
  const alpha=ctx.getImageData(100+8*64,196+3.5*64,1,1).data[3];ctx.drawImage=drawImage;ctx.fillRect=fill;draw();
  return {x:KIT_TEST.state.player.x,alpha};
 });
 assert.equal(passage.x,8.5);assert(passage.alpha<20,'the tall internal wall must leave a visible, traversable passage');
 result.puzzlePassage=passage;
 await writeFile('Prototypes/DungeonWalk/Validation/integrated-door-report.json',JSON.stringify({status:'passed',...result},null,2)+'\n');
 console.log('Tall integrated doorway and continuous lintel passed');
}finally{await browser.close();}
