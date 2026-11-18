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
  const walkUntil = async (key, condition) => {
    await page.keyboard.down(key);
    try {
      await page.waitForFunction(condition, undefined, {timeout: 7000});
    } finally {
      await page.keyboard.up(key);
    }
  };
  const interact = async () => {
    await page.keyboard.press('e');
    await page.waitForFunction(() => !KIT_TEST.state.pushing);
  };

  // Use actual movement and interactions for the entire solution.
  await walkUntil('ArrowUp', () => KIT_TEST.state.player.y <= 2.8);
  await walkUntil('ArrowRight', () => KIT_TEST.state.player.x >= 9.45);
  await interact();
  assert.equal((await state()).questStage, 'gate');
  await page.waitForFunction(() => document.querySelector('#objective').textContent.includes('锁着'));
  await walkUntil('ArrowLeft', () => KIT_TEST.state.player.x <= 4.5);
  await walkUntil('ArrowDown', () => KIT_TEST.state.player.y >= 4.48);
  await interact();
  await interact();
  assert.equal((await state()).questStage, 'key');
  assert.equal((await state()).plateDown, true);

  await walkUntil('ArrowUp', () => KIT_TEST.state.player.y <= 1.1);
  await walkUntil('ArrowRight', () => KIT_TEST.state.player.x >= 6.4);
  await walkUntil('ArrowUp', () => KIT_TEST.state.layout === 'elbow');
  await page.locator('#stage').screenshot({path: 'Prototypes/DungeonWalk/Validation/quest-key.png'});
  await walkUntil('ArrowDown', () => KIT_TEST.state.player.y >= 1.7);
  await walkUntil('ArrowRight', () => KIT_TEST.state.questStage === 'chest');
  await walkUntil('ArrowLeft', () => KIT_TEST.state.player.x <= 6.57);
  await walkUntil('ArrowUp', () => KIT_TEST.state.layout === 'hall');
  await walkUntil('ArrowDown', () => KIT_TEST.state.player.y >= 2.55);
  await walkUntil('ArrowRight', () => KIT_TEST.state.player.x >= 8.65);
  await interact();
  assert.equal((await state()).questStage, 'complete');
  await interact();
  await page.waitForFunction(() => document.querySelector('#objective').textContent.includes('谜题完成'));
  await page.locator('#stage').screenshot({path: 'Prototypes/DungeonWalk/Validation/quest-complete.png'});

  const cutaway = await page.evaluate(() => {
    const c = document.querySelector('#stage').getContext('2d');
    draw();
    return {
      bottom: [...c.getImageData(300, 724, 1, 1).data],
      side: [...c.getImageData(89, 650, 1, 1).data],
    };
  });
  assert.deepEqual(cutaway.bottom, [37, 52, 61, 255], 'south wall facade should be absent');
  assert.notDeepEqual(cutaway.side, cutaway.bottom, 'side wall should reach the cutaway edge');

  await walkUntil('ArrowDown', () => KIT_TEST.state.player.y >= 5.45);
  await interact();
  assert.equal((await state()).layout, 'arena');
  assert.equal((await state()).door, false);
  await place(6.5, .06);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(210);
  await page.keyboard.up('ArrowUp');
  assert((await state()).player.y >= 0, 'slime must block the north exit');

  const faceSlime = side => page.evaluate(side => {
    const {enemy} = KIT_TEST.state.battle;
    KIT_TEST.setPlayer(enemy.x - 1.08, enemy.y);
    KIT_TEST.move(side * .001, 0);
  }, side);
  await faceSlime(-1);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !KIT_TEST.state.battle.attack);
  assert.equal((await state()).battle.enemyHp, 3, 'a swing away from the slime must miss');
  await page.waitForFunction(() => KIT_TEST.state.battle.heroHp < 3);
  await page.waitForFunction(() => KIT_TEST.state.battle.heroHp === 0, undefined, {timeout: 10000});
  await page.keyboard.press('r');
  assert.equal((await state()).battle.heroHp, 3);
  assert.equal((await state()).questStage, 'complete', 'retry keeps the solved room puzzle');
  // Aiming with the movement direction should connect exactly once per swing.
  for (const hp of [2, 1, 0]) {
    await faceSlime(1);
    await page.keyboard.press('Space');
    await page.waitForFunction(target => KIT_TEST.state.battle.enemyHp === target, hp);
    if (hp === 2) await page.locator('#stage').screenshot({path: 'Prototypes/DungeonWalk/Validation/arena-attack.png'});
    await page.waitForFunction(() => !KIT_TEST.state.battle.attack);
    assert.equal((await state()).battle.enemyHp, hp);
  }
  assert.equal((await state()).door, true);
  await place(6.5, .1);
  await walkUntil('ArrowUp', () => KIT_TEST.state.battle.escaped);
  await page.waitForFunction(() => document.querySelector('#objective').textContent.includes('地牢通关'));
  await page.locator('#stage').screenshot({path: 'Prototypes/DungeonWalk/Validation/arena-cleared.png'});

  await page.locator('#restart').click();
  await place(2.5, 7.95);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowDown');
  assert((await state()).player.y < 8, 'south collision must remain');

  await page.locator('#restart').click();
  assert.equal((await state()).questStage, 'gate');
  assert.equal((await state()).door, false);
  await page.locator('#door').click();
  await place(6.5, .1);
  await walkUntil('ArrowUp', () => KIT_TEST.state.layout === 'elbow');
  await place(9, 1.8);
  await walkUntil('ArrowRight', () => KIT_TEST.state.player.x >= 9.5);
  assert.equal((await state()).questStage, 'gate', 'the preview door toggle cannot grant the quest key');
  console.log('Treasure quest, combat aiming and hurt, retry, exit, and finished cutaway walls passed.');
} finally {
  await browser.close();
}
