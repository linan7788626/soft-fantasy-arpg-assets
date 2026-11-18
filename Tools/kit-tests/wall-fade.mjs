import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 1040}});
  await page.goto(pathToFileURL(resolve('Prototypes/DungeonWalk/index.html')).href);
  await page.waitForFunction(() => window.KIT_TEST);
  const cases = [
    {layout: 'hall', player: [2.5, 7.95], near: [305, 600], far: [410, 600], rest: [2.5, 5.5]},
    {layout: 'elbow', player: [8.5, 3.5], near: [689, 365], far: [790, 365], rest: [8.5, 1]},
    {layout: 'puzzle', player: [2.5, 7.95], near: [305, 600], far: [410, 600], rest: [2.5, 5.5]},
    {layout: 'hall', player: [6.5, -0.3], near: [485, 76, 64, 36], far: [606, 127], rest: [6.5, 2], open: true},
  ];
  for (const scenario of cases) {
    await page.locator('#layout').selectOption(scenario.layout);
    if (scenario.open) await page.locator('#door').click();
    const result = await page.evaluate(({player, near, far, rest}) => {
      const context = document.querySelector('#stage').getContext('2d');
      const pixel = ([x, y, width = 1, height = 1]) =>
        Array.from(context.getImageData(x, y, width, height).data);
      KIT_TEST.setPlayer(...player);
      draw({wallFade: false, cutaway: false});
      const solid = [pixel(near), pixel(far)];
      draw({cutaway: false});
      const faded = [pixel(near), pixel(far)];
      KIT_TEST.setPlayer(...rest);
      draw({wallFade: false, cutaway: false});
      const restSolid = pixel(near);
      draw({cutaway: false});
      return {solid, faded, restSolid, restFaded: pixel(near)};
    }, scenario);
    assert.notDeepEqual(result.faded[0], result.solid[0], `${scenario.layout} ${scenario.player}: local wall should fade`);
    assert.deepEqual(result.faded[1], result.solid[1], `${scenario.layout} ${scenario.player}: distant wall should stay opaque`);
    assert.deepEqual(result.restFaded, result.restSolid, `${scenario.layout} ${scenario.player}: wall should recover when hero leaves`);
  }
  console.log('Local wall fading, recovery and untouched far wall verified in four views.');
} finally {
  await browser.close();
}
