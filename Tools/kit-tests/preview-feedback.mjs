import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const browser=await chromium.launch();const page=await browser.newPage();
try{
 await page.goto(pathToFileURL(resolve('Prototypes/DungeonWalk/index.html')).href);await page.waitForFunction(()=>window.KIT_TEST);
 const f=await page.evaluate(()=>KIT_TEST.state.frame);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>KIT_TEST.state.frame),f,'idle hero must not walk in place');
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(180);const walking=await page.evaluate(()=>KIT_TEST.state.frame);await page.waitForTimeout(140);assert.notEqual(await page.evaluate(()=>KIT_TEST.state.frame),walking);await page.keyboard.up('ArrowRight');await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>KIT_TEST.state.frame),f);
 await page.evaluate(()=>KIT_TEST.setPlayer(.01,2.5));await page.keyboard.down('ArrowLeft');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>KIT_TEST.state.frame),f,'walking into a wall must stay idle');await page.keyboard.up('ArrowLeft');
 await page.evaluate(()=>KIT_TEST.setPlayer(4.5,4.5));await page.keyboard.press('e');
 await page.keyboard.press('e');assert.equal(await page.evaluate(()=>KIT_TEST.state.crate.x),6,'repeated push cannot jump another tile');
 assert.equal(await page.evaluate(()=>!!KIT_TEST.state.pushing),true,'crate must interpolate rather than teleport');
 await page.waitForTimeout(80);const interim=await page.evaluate(()=>KIT_TEST.state.crateVisual.x);assert(interim>5&&interim<6,'crate must pass through intermediate positions');
 await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>!!KIT_TEST.state.pushing),false);
 assert.equal(await page.evaluate(()=>KIT_TEST.geometry.northWallCells.includes(6)),false,'gate opening must not have a wall behind it');
 assert.equal(await page.evaluate(()=>KIT_TEST.state.player.x),5.5,'hero accompanies the push');
 await page.evaluate(()=>KIT_TEST.push());await page.waitForFunction(()=>!KIT_TEST.state.pushing);assert.equal(await page.evaluate(()=>KIT_TEST.state.door),true);
 await mkdir('Prototypes/DungeonWalk/Validation',{recursive:true});
 for(const layout of ['hall','elbow','puzzle']){
 await page.locator('#layout').selectOption(layout);await page.waitForTimeout(40);await page.locator('#stage').screenshot({path:`Prototypes/DungeonWalk/Validation/${layout}-closed.png`});
 await page.locator('#door').click();await page.waitForTimeout(40);await page.locator('#stage').screenshot({path:`Prototypes/DungeonWalk/Validation/${layout}-open.png`});
 }
 await writeFile('Prototypes/DungeonWalk/Validation/feedback-report.json',JSON.stringify({status:'passed',checks:['idle frame frozen','real movement advances frames','stopping returns to idle','blocked movement stays idle','repeat push cannot teleport','crate has intermediate positions','hero follows crate','plate activates after movement','door uses a wall gap','three layouts open/closed screenshots']},null,2)+'\n');
 console.log('Preview feedback regression passed');
}finally{await browser.close();}
