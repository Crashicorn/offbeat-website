// Chromium acceptance: run with CHROME_BIN and BASE_URL against a static server.
'use strict';
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
(async () => {
  const browser = await puppeteer.launch({executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', headless:true, args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    for (const width of [1440, 390]) {
      const context = await browser.createBrowserContext(); const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      page.on('dialog', d => d.type() === 'prompt' ? d.accept('Test rig') : d.accept());
      await page.setViewport({width, height:900});
      await page.goto(base+'/build-your-dj-setup.html?preset=bedroom-starter', {waitUntil:'networkidle0'});
      await page.waitForSelector('.visual-controller .visual-pick');
      if (await page.$('.ob-consent-btn:nth-child(2)')) await page.click('.ob-consent-btn:nth-child(2)');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth), 0);
      await page.screenshot({path:`evidence/rig-architect-2026/bedroom-${width}.png`});
      assert.equal(await page.evaluate(() => __rigStudio.checks().find(c => c.key === 'cables').level), 'ok',
        'bedroom pair has a genuinely included cable');
      await page.goto(base+'/build-your-dj-setup.html?preset=mobile-pro', {waitUntil:'networkidle0'});
      await page.click('.visual-monitor .visual-pick');
      await page.waitForSelector('[data-action="select-item"][data-item-id="yamaha-hs5"]', {visible:true});
      await page.screenshot({path:`evidence/rig-architect-2026/picker-${width}.png`});
      await page.click('[data-action="select-item"][data-item-id="yamaha-hs5"]');
      assert.match(await page.$eval('.visual-monitor', e=>e.textContent), /HS5/);
      await page.click('.visual-pa .visual-pick');
      assert.equal(await page.$('[data-action="select-item"][data-item-id="yamaha-hs5"]'), null);
      await page.click('[data-action="select-item"][data-item-id="qsc-k10-2"]');
      const before = await page.evaluate(()=>__rigStudio.cost().purchase);
      await page.click('.visual-pa .visual-own');
      assert.ok(await page.evaluate(()=>__rigStudio.cost().purchase) < before);
      assert.ok(!(await page.evaluate(()=>__rigStudio.shoppingList())).some(x=>x.itemId==='qsc-k10-2'));
      await page.click('.visual-controller .visual-pick');
      await page.click('[data-action="select-item"][data-item-id="pioneer-ddj-flx4"]');
      assert.match(await page.$eval('.visual-route', e=>e.textContent), /limitation/i);
      assert.equal(await page.evaluate(() => __rigStudio.checks().find(c => c.key === 'cables').level), 'warn',
        'FLX4 dual-zone output conflict must never receive a green cable verdict');
      assert.equal(await page.evaluate(() => __rigStudio.checks().find(c => c.key === 'host').level), 'warn',
        'a laptop-dependent FLX4 with standalone USB-only host is not connected');
      await page.$eval('#interactive-booth-stage', el=>el.scrollIntoView());
      await (await page.$('#interactive-booth-stage')).screenshot({path:`evidence/rig-architect-2026/mobile-rig-${width}.png`});
      await page.click('.visual-route-link');
      await page.waitForFunction(()=>document.querySelector('#rig-connections').open, {timeout:3000});
      assert.match(await page.$eval('#signal-highway', e=>e.textContent), /splitter|separate output/i);
      await page.click('#rig-manage > summary');
      await page.click('[data-action="save-rig"]');
      assert.match(await page.evaluate(()=>localStorage.getItem('offbeat.rigs.saved')), /Test rig/);
      const url = await page.evaluate(()=>__rigStudio.shareUrl());
      await page.goto(url, {waitUntil:'networkidle0'});
      assert.match(await page.$eval('.visual-controller',e=>e.textContent), /FLX4/);
      assert.match(await page.$eval('.visual-monitor',e=>e.textContent), /HS5/);
      assert.match(await page.$eval('.visual-pa .visual-own',e=>e.textContent), /Owned/);
      await page.click('.visual-controller .visual-pick');
      await page.click('[data-action="select-item"][data-item-id="denon-prime-4-plus"]');
      assert.match(await page.$eval('.visual-controller',e=>e.textContent), /Prime 4\+/i);
      await page.click('#rig-manage > summary');
      await page.click('[data-action="load-saved-rig"]');
      assert.match(await page.$eval('.visual-controller',e=>e.textContent), /FLX4/);
      // A three-cabinet PA needs two retail cable packs, not just one.
      await page.goto(base+'/build-your-dj-setup.html?preset=mobile-pro', {waitUntil:'networkidle0'});
      const state = await page.evaluate(()=>__rigStudio.state());
      state.items.find(s=>s.category==='speakers').qty=3;
      const encoded = Buffer.from(encodeURIComponent(JSON.stringify(state))).toString('base64');
      await page.goto(base+'/build-your-dj-setup.html?rig='+encodeURIComponent(encoded), {waitUntil:'networkidle0'});
      assert.equal((await page.evaluate(()=>__rigStudio.connections()))[0].units, 2);
      assert.equal(await page.evaluate(() => __rigStudio.checks().find(c => c.key === 'cables').level), 'warn',
        'three PA cabinets with one cable pack cannot be called cable-ready');
      assert.match(await page.$eval('#rs-compatibility', e => e.textContent),
        /Speaker Cable Quantity or Routing Needs Review/,
        'visible compatibility verdict must agree with the booth cable deficit');
      assert.match(await page.$eval('.visual-pa',e=>e.textContent), /3 cabinets.*Cable needed|Cable needed[\s\S]*3 cabinets/);
      await page.click('#rig-shopping > summary');
      const cableSlot = await page.evaluate(()=>__rigStudio.state().items.find(s=>s.category==='cables').slotId);
      await page.click(`[data-action="step-qty"][data-slot-id="${cableSlot}"][data-step="1"]`);
      assert.match(await page.$eval('.visual-pa',e=>e.textContent), /Cable in plan/);
      assert.equal(await page.evaluate(() => __rigStudio.checks().find(c => c.key === 'cables').level), 'ok',
        'second cable pack covers both planned PA feeds');
      assert.match(await page.$eval('#rs-compatibility', e => e.textContent),
        /Listed Audio Connection Match/,
        'compatibility verdict recovers only after sufficient cable quantity');
      await page.click('.visual-pa .visual-pick');
      await page.type('[data-modal-search]', 'no-such-model-123');
      assert.match(await page.$eval('.picker-empty',e=>e.textContent), /No components/);
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []);
      console.log(`${width}px: bedroom, role gating, PA/monitor editing, ownership, routing limitation, save/share/reopen/edit passed`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{ console.error(e); process.exitCode=1; });
