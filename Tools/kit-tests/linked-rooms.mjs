import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 1040}});
  await page.goto(pathToFileURL(resolve('Prototypes/DungeonWalk/index.html')).href);
  await page.waitForFunction(() => window.KIT_TEST);
  const state = () => page.evaluate(() => KIT_TEST.state);
  const place = (x, y) => page.evaluate(([x, y]) => KIT_TEST.setPlayer(x, y), [x, y]);
  const moveThroughDoor = async (destination) => {
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(room => KIT_TEST.state.layout === room, destination);
    await page.waitForTimeout(850);
    assert.equal((await state()).layout, destination, 'holding Up must not bounce back');
    assert.equal((await state()).player.y, .58, 'arrival must stay just inside the destination');
    await page.keyboard.up('ArrowUp');
    await page.waitForFunction(() => !requireNorthRelease);
  };

  await place(6.5, .15);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(220);
  await page.keyboard.up('ArrowUp');
  assert((await state()).player.y >= 0, 'closed north gate blocks the connector');

  for (const x of [4.5, 5.5]) {
    await place(x, 4.5);
    await page.keyboard.press('e');
    await page.waitForFunction(() => !KIT_TEST.state.pushing);
  }
  assert.equal((await state()).door, true);
  const floorColor = () => page.evaluate(() =>
    Array.from(KIT_TEST.images.floor.getContext('2d').getImageData(200, 200, 1, 1).data));
  const hallFloor = await floorColor();
  await place(6.5, .1);
  await moveThroughDoor('elbow');
  assert.notDeepEqual(await floorColor(), hallFloor, 'destination should have its own palette');
  await page.locator('#stage').screenshot({path: 'Prototypes/DungeonWalk/Validation/linked-elbow.png'});

  await place(2.5, 4.5);
  await page.keyboard.press('e');
  await page.waitForFunction(() => !KIT_TEST.state.pushing);
  assert.equal((await state()).plateDown, true);
  await place(3.5, 4.5);
  await page.keyboard.press('e');
  await page.waitForFunction(() => !KIT_TEST.state.pushing);
  assert.equal((await state()).plateDown, false);
  assert.equal((await state()).door, true, 'the return entrance survives plate release');
  await place(6.5, .1);
  await moveThroughDoor('hall');
  assert.deepEqual((await state()).crate, {x: 7, y: 4}, 'hall progress must survive return');
  assert.equal((await state()).plateDown, true);
  assert.equal((await state()).door, true);
  assert.deepEqual(await floorColor(), hallFloor);
  await page.locator('#stage').screenshot({path: 'Prototypes/DungeonWalk/Validation/linked-hall.png'});
  await moveThroughDoor('elbow');
  assert.deepEqual((await state()).crate, {x: 5, y: 4}, 'destination progress must survive reentry');

  await page.locator('#layout').selectOption('puzzle');
  await page.locator('#door').click();
  await place(6.5, .1);
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => KIT_TEST.state.player.y < -.8);
  await page.keyboard.up('ArrowUp');
  assert.equal((await state()).layout, 'puzzle', 'unlinked test room keeps its local passage');
  console.log('Closed gate, round trip, held input, both room states and distinct palettes passed.');
} finally {
  await browser.close();
}
