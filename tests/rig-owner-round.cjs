'use strict';
// Run with CHROME_BIN and BASE_URL against a static server.
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
(async () => {
  const browser = await puppeteer.launch({executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    for (const width of [1440,390]) {
      const context = await browser.createBrowserContext(), page = await context.newPage();
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.setViewport({width,height:width===390?844:900});
      await page.goto(base+'/build-your-dj-setup.html',{waitUntil:'networkidle0'});
      await page.waitForSelector('.visual-stage');
      if (await page.$('.ob-consent-btn:nth-child(2)')) await page.click('.ob-consent-btn:nth-child(2)');
      const state=await page.evaluate(()=>({rig:__rigStudio.state(),cost:__rigStudio.cost().purchase,route:document.querySelector('.visual-route').textContent,critical:document.querySelector('.visual-critical')?.textContent||'',shopping:document.querySelector('#rig-shopping').open,connections:document.querySelector('#rig-connections').open,badge:[...document.querySelectorAll('[data-preset-id="bedroom-starter"] .preset-badge')][0].textContent}));
      assert.equal(state.cost,627); assert.match(state.badge,/\$627/);
      const krk = await page.evaluate(()=>[__rigStudio.item('krk-rokit-5-g4'),__rigStudio.item('krk-classic-5-pair')]);
      assert.equal(krk[0].price,169); assert.equal(krk[0].speaker_units,1);
      assert.equal(krk[1].price,299); assert.equal(krk[1].speaker_units,2);
      for (const item of krk) assert.ok(item.pack_note && item.price_basis && item.retailer_destinations);
      assert.deepEqual(state.rig.items.map(x=>x.itemId).sort(),['pioneer-ddj-flx4','sennheiser-hd25','pioneer-dm40d','existing-mobile-device'].sort());
      assert.doesNotMatch(state.route + state.critical,/limitation|incompatible/i);
      assert.equal(state.shopping,true); assert.equal(state.connections,width>700);
      assert.equal(await page.$eval('.visual-controller img', e=>e.currentSrc.includes('pioneer-ddj-flx4-commons.jpg') && e.naturalWidth>0),true);
      assert.equal(await page.$eval('.visual-headphones img', e=>e.currentSrc.includes('sennheiser-hd25-commons.jpg') && e.naturalWidth>0),true);
      await page.screenshot({path:`evidence/rig-architect-2026/owner-round/after-${width}.png`});
      if (!state.connections) await page.$eval('#rig-connections > summary', e=>e.click());
      assert.equal(await page.$eval('#rig-shopping', e=>e.open),true);
      assert.equal(await page.$eval('#rig-connections', e=>e.open),true);
      // Preserve both independent states through a state-changing render.
      await page.$eval('.visual-controller .visual-own',e=>e.click());
      assert.equal(await page.$eval('#rig-shopping', e=>e.open),true);
      assert.equal(await page.$eval('#rig-connections', e=>e.open),true);
      await page.screenshot({path:`evidence/rig-architect-2026/owner-round/open-sections-${width}.png`,fullPage:true});
      await page.$eval('.visual-headphones .visual-pick',e=>e.click());
      await page.waitForSelector('[data-item-id="sony-mdr-7506"] .picker-card-img');
      let sony=await page.$eval('[data-item-id="sony-mdr-7506"] .picker-card-img',e=>({src:e.getAttribute('src'),natural:e.naturalWidth}));
      assert.match(sony.src,/sony-mdr-7506-commons\.jpg/); assert.ok(sony.natural>0);
      await page.$eval('[data-modal-search]',e=>{e.value='MDR-7506'; e.dispatchEvent(new Event('input',{bubbles:true}));});
      await page.waitForSelector('[data-item-id="sony-mdr-7506"] .picker-card-img');
      await page.screenshot({path:`evidence/rig-architect-2026/owner-round/sony-picker-${width}.png`});
      await page.click('.picker-close');
      // Microphone is in the shopping list; open its picker via the existing slot.
      await page.goto(base+'/build-your-dj-setup.html?preset=mobile-pro',{waitUntil:'networkidle0'});
      await page.$eval('#rig-shopping [data-category="microphones"][data-action="pick"]',e=>e.click());
      await page.waitForSelector('[data-item-id="mic-shure-sm58"] .picker-card-img');
      assert.equal(await page.$eval('[data-item-id="mic-shure-sm58"] .picker-card-img',e=>e.currentSrc.includes('mic-shure-sm58-commons.jpg') && e.naturalWidth>0),true);
      await page.$eval('[data-modal-search]',e=>{e.value='SM58';e.dispatchEvent(new Event('input',{bubbles:true}));});
      await page.waitForSelector('[data-item-id="mic-shure-sm58"] .picker-card-img');
      await page.screenshot({path:`evidence/rig-architect-2026/owner-round/sm58-picker-${width}.png`});
      assert.deepEqual(errors,[]); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
      console.log(`${width}: default rig, independent views, photos and credits passed`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
