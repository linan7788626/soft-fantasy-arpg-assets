import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const browser=await chromium.launch();const page=await browser.newPage();
const out='Prototypes/DungeonWalk/Validation';
try{
 await page.goto(pathToFileURL(resolve('Prototypes/DungeonWalk/index.html')).href);
 await page.waitForFunction(()=>window.KIT_TEST);
 const checks=[];
 for(const [direction,key] of Object.entries({east:'ArrowRight',south:'ArrowDown',west:'ArrowLeft',north:'ArrowUp'})){
  await page.locator('#layout').selectOption('hall');
  await page.evaluate(()=>KIT_TEST.setPlayer(3.5,3.5));
  await page.keyboard.down(key);
  await page.waitForFunction(d=>KIT_TEST.state.direction===d,direction);
  await page.waitForFunction(()=>KIT_TEST.state.frame!==1);
  await page.keyboard.up(key);
  await page.waitForFunction(()=>KIT_TEST.state.frame===1);
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>KIT_TEST.state.frame),1);
  for(const bg of ['light','dark','checker']){
   await page.locator('#background').selectOption(bg);await page.waitForTimeout(40);
   await page.locator('#frames').screenshot({path:`${out}/direction-${direction}-${bg}.png`});
  }
  const digest=await page.evaluate(()=>document.querySelector('#frames').toDataURL());
  checks.push({direction,idle:1,stripDigest:createHash('sha256').update(digest).digest('hex')});
 }
 assert.equal(new Set(checks.map(c=>c.stripDigest)).size,4,'four distinct source strips must be shown');
 await page.locator('#layout').selectOption('hall');
 await page.evaluate(()=>KIT_TEST.setPlayer(4.5,4.5));
 await page.keyboard.press('e');await page.waitForFunction(()=>!KIT_TEST.state.pushing);
 await page.keyboard.press('e');await page.waitForFunction(()=>KIT_TEST.state.plateDown&&KIT_TEST.state.plateBlend===1);
 assert.equal(await page.evaluate(()=>KIT_TEST.state.door),true);
 await page.locator('#mechanisms').screenshot({path:`${out}/pressure-states.png`});
 await page.keyboard.press('e');await page.waitForFunction(()=>!KIT_TEST.state.pushing&&KIT_TEST.state.plateBlend===0);
 assert.equal(await page.evaluate(()=>KIT_TEST.state.door),false);
 await writeFile(`${out}/directions-report.json`,JSON.stringify({status:'passed',checks,dynamicChecks:['actual input selects four directions','walking advances then freezes on idle','light/dark/checker composites','settled crate presses plate and opens gate','leaving plate releases state and closes gate']},null,2)+'\n');
 console.log('Four-direction input, idle and plate release tests passed');
}finally{await browser.close();}
