import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch();const page=await browser.newPage();
const out='Prototypes/DungeonWalk/Validation';
try{
 await page.goto(pathToFileURL(resolve('Prototypes/DungeonWalk/index.html')).href);await page.waitForFunction(()=>window.KIT_TEST);
 const rows=[];
 for(const [direction,player,expected] of [['east',[4.5,4.5],[6,4]],['west',[6.5,4.5],[4,4]],['north',[5.5,5.8],[5,3]],['south',[5.5,3.5],[5,5]]]){
  await page.locator('#layout').selectOption('hall');
  await page.locator('#direction').selectOption(direction);
  for(const action of ['idle','walk','push']){
   await page.locator('#action').selectOption(action);await page.waitForTimeout(40);
   await page.locator('#frames').screenshot({path:`${out}/action-${action}-${direction}.png`});
  }
  await page.locator('#action').selectOption('walk');
  await page.evaluate(p=>KIT_TEST.setPlayer(...p),player);
  await page.keyboard.press('e');
  await page.waitForFunction(()=>KIT_TEST.state.pushPhase==='push');
  const start=await page.evaluate(()=>KIT_TEST.state.crateVisual);
  await page.waitForTimeout(100);
  const middle=await page.evaluate(()=>KIT_TEST.state);
  assert.equal(middle.action,'push');assert.equal(middle.direction,direction);
  assert(Math.hypot(middle.crateVisual.x-start.x,middle.crateVisual.y-start.y)>0,'crate must move continuously during effort');
  await page.locator('#stage').screenshot({path:`${out}/contact-${direction}.png`});
  await page.waitForFunction(()=>!KIT_TEST.state.pushing);
  assert.deepEqual(await page.evaluate(()=>[KIT_TEST.state.crate.x,KIT_TEST.state.crate.y]),expected);
  await page.waitForFunction(()=>KIT_TEST.state.action==='idle');
  // In particular, a south push must not leave the feet trapped in the
  // crate's whole tile or misidentify the next push as north.
  await page.keyboard.press('e');await page.waitForFunction(()=>!KIT_TEST.state.pushing);
  assert.equal(await page.evaluate(()=>KIT_TEST.state.direction),direction);
  await page.keyboard.down('ArrowLeft');await page.waitForTimeout(120);await page.keyboard.up('ArrowLeft');
  rows.push({direction,passed:true});
 }
 await page.locator('#layout').selectOption('hall');
 await page.evaluate(()=>KIT_TEST.setPlayer(5.5,3.5));
 for(let i=0;i<3;i++){await page.keyboard.press('e');await page.waitForFunction(()=>!KIT_TEST.state.pushing);}
 await page.evaluate(()=>KIT_TEST.setPlayer(4.5,7.5));
 assert.equal(await page.evaluate(()=>KIT_TEST.push()),false,'auto-approach must not carry the feet outside the south wall');
 assert.deepEqual(await page.evaluate(()=>[KIT_TEST.state.crate.x,KIT_TEST.state.crate.y]),[5,7]);
 await writeFile(`${out}/actions-report.json`,JSON.stringify({status:'passed',checks:['dedicated idle/walk/push strips','four direction contacts and continuous crate motion','same-direction repeated pushes including south','idle restoration after release','auto-approach cannot cross the south wall'],directions:rows},null,2)+'\n');
 console.log('Dedicated actions and four-direction push contacts passed');
}finally{await browser.close();}
