import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const module=process.env.PLAYWRIGHT_MODULE||createRequire(import.meta.url).resolve('playwright');
const library=await import(pathToFileURL(module));
const chromium=library.chromium || library.default.chromium;
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const out=resolve('Prototypes/DungeonWalk/Validation');await mkdir(out,{recursive:true});
try{
 await page.goto(pathToFileURL(resolve('Prototypes/DungeonWalk/index.html')).href);await page.waitForFunction(()=>window.KIT_TEST);
 assert.equal(await page.evaluate(()=>Object.keys(KIT_TEST.images).length),9);
 await page.locator('#play').click();const f=await page.evaluate(()=>KIT_TEST.state.frame);await page.locator('#step').click();assert.equal(await page.evaluate(()=>KIT_TEST.state.frame),(f+1)%6);
 for(const layout of ['hall','elbow','puzzle']){await page.locator('#layout').selectOption(layout);await page.waitForTimeout(60);assert.equal(await page.evaluate(()=>KIT_TEST.state.layout),layout);await page.locator('#stage').screenshot({path:out+'/'+layout+'.png'});}
 await page.locator('#layout').selectOption('hall');await page.evaluate(()=>{KIT_TEST.setPlayer(4.5,4.5);});await page.keyboard.press('e');assert.equal(await page.evaluate(()=>KIT_TEST.state.crate.x),6);await page.evaluate(()=>{KIT_TEST.setPlayer(5.5,4.5);});await page.keyboard.press('e');assert.equal(await page.evaluate(()=>KIT_TEST.state.door),true);
 await page.evaluate(()=>{KIT_TEST.setPlayer(5.5,.1);KIT_TEST.move(0,-.5);});assert((await page.evaluate(()=>KIT_TEST.state.player.y))<0);
 await page.evaluate(()=>{KIT_TEST.setPlayer(.1,2.5);KIT_TEST.move(-1,0);});assert.equal(await page.evaluate(()=>KIT_TEST.state.player.x),.1);
 for(const background of ['light','checker','dark']){await page.locator('#background').selectOption(background);await page.waitForTimeout(30);await page.locator('#frames').screenshot({path:out+'/frames-'+background+'.png'});}
 await page.locator('#play').click();const before=await page.evaluate(()=>KIT_TEST.state.frame);await page.waitForTimeout(160);assert.notEqual(await page.evaluate(()=>KIT_TEST.state.frame),before);
 assert.deepEqual(errors,[]);
 const report={status:'passed',checks:['9 native images loaded offline','three room layouts','pause and single frame step','6 frame timed loop','crate pushes and plate opens door','perimeter collision and opened gate passage','dark/light/checker backgrounds'],errors};await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
