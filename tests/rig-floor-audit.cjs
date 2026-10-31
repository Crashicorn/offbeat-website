'use strict';
// Chromium audit for the rig page, using the owner-provided measurement.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
const label = process.env.AUDIT_LABEL || 'after';
const audit = () => {
  const vw = document.documentElement.clientWidth;
  const out = { pageOverflowX: document.documentElement.scrollWidth - vw,
                beyondViewport: 0, spillVisible: 0, spillTop: [] };
  const scrollable = (el) => { let p = el.parentElement, n = 0;
    while (p && p !== document.body && n < 10) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return true;
      p = p.parentElement; n++; } return false; };
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) continue;
    if (r.right > vw + 1 && r.left >= -1 && r.left < vw && !scrollable(el)) out.beyondViewport++;
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2 && cs.overflowX === 'visible') {
      out.spillVisible++;
      if (out.spillTop.length < 5) out.spillTop.push(
        el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\s+/).slice(0, 3).join('.')
        + ' +' + (el.scrollWidth - el.clientWidth) + 'px'); } }
  return out; };
(async()=>{
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN || '/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
  const results={};
  try { for (const width of [1280,390]) {
    const context=await browser.createBrowserContext(); const page=await context.newPage();
    await page.setViewport({width,height:width===390?844:800});
    await page.goto(base+'/build-your-dj-setup.html',{waitUntil:'networkidle0'});
    await page.waitForSelector('.visual-controller .visual-pick');
    if(await page.$('.ob-consent-btn:nth-child(2)')) await page.click('.ob-consent-btn:nth-child(2)');
    const prefix=`evidence/rig-architect-2026/round-7/${label}-${width}`;
    results[width]={};
    results[width].first=await page.evaluate(audit);
    results[width].first.compat=await page.$eval('.compat-status-tag',el=>el.textContent.trim());
    results[width].first.warningCount=await page.$$eval('.compat-item--warning',el=>el.length);
    if (label === 'after') {
      assert.equal(await page.evaluate(() => window.__rigStudio.cost().buyTotal), 627);
      assert.match(await page.$eval('.rig-preset-pill', el => el.innerText.replace(/\s+/g,' ')), /Est\. \$627 total/);
      assert.equal(await page.evaluate(() => window.__rigStudio.checks().find(c => c.key === 'host').level), 'warn', 'underlying host readiness remains conservative');
    }
    await page.screenshot({path:prefix+'-first.png'});
    await (await page.$('.visual-headphones')).screenshot({path:prefix+'-headphones.png'});
    for(const id of ['rig-connections','rig-shopping','rig-manage']) {
      if(!await page.$eval('#'+id,el=>el.open)) await page.$eval('#'+id+' > summary',el=>el.click());
    }
    results[width].expanded=await page.evaluate(audit);
    await page.screenshot({path:prefix+'-expanded.png',fullPage:true});
    await page.$eval('.visual-headphones .visual-pick',e=>e.click());
    await page.waitForSelector('button[data-action="select-item"][data-item-id="sony-mdr-7506"]');
    await page.$eval('button[data-action="select-item"][data-item-id="sony-mdr-7506"]',e=>e.click());
    results[width].selected=await page.evaluate(audit);
    results[width].selected.compat=await page.$eval('.compat-status-tag',el=>el.textContent.trim());
    results[width].selected.warningCount=await page.$$eval('.compat-item--warning',el=>el.length);
    await page.screenshot({path:prefix+'-selected.png',fullPage:true});
    if (label === 'after') {
      const shared = await page.evaluate(() => window.__rigStudio.shareUrl());
      await page.reload({waitUntil:'networkidle0'});
      assert.match(await page.$eval('.compat-status-tag', el => el.textContent), /Connection Verification Needed/, 'restored edited rig warns');
      const sharedContext = await browser.createBrowserContext();
      const sharedPage = await sharedContext.newPage();
      await sharedPage.goto(shared, {waitUntil:'networkidle0'});
      assert.match(await sharedPage.$eval('.compat-status-tag', el => el.textContent), /Connection Verification Needed/, 'shared rig warns');
      await sharedPage.goto(base+'/build-your-dj-setup.html?preset=bedroom-starter', {waitUntil:'networkidle0'});
      assert.match(await sharedPage.$eval('.compat-status-tag', el => el.textContent), /Connection Verification Needed/, 'explicit preset selection warns');
      await sharedContext.close();
    }
    await context.close();
  }} finally { await browser.close(); }
  fs.writeFileSync(`evidence/rig-architect-2026/round-7/${label}-audit.json`,JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
  if(label==='after') for (const v of Object.values(results)) {
    for(const key of ['first','expanded','selected']) {
      assert.ok(v[key].pageOverflowX<=1, key+' page overflow');
      assert.equal(v[key].beyondViewport,0,key+' beyond viewport');
      assert.equal(v[key].spillVisible,0,key+' visible spills');
    }
    assert.doesNotMatch(v.first.compat,/⚠|warning|verification needed/i);
    assert.equal(v.first.warningCount,0);
    assert.match(v.selected.compat,/Connection Verification Needed/);
    assert.ok(v.selected.warningCount > 0, 'edited mobile host remains unverified');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
