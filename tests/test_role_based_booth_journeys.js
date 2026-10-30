// Browser journeys for one authoritative equipment canvas, routing and saved state.
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const CHROME = process.env.CHROME_BIN || '/usr/local/bin/chromium';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.type() === 'prompt' ? d.accept('Two-zone test') : d.accept());
    await page.setViewport({width:1440,height:900});
    const visit = async preset => {
      await page.goto(`${BASE}/build-your-dj-setup.html?preset=${preset}`, {waitUntil:'networkidle0'});
      const consent = await page.$('.ob-consent-btn:nth-child(2)');
      if (consent) await consent.click();
    };
    // Opening a section must not accidentally collapse an already-open default view.
    const ensureOpen = async selector => {
      if (!await page.$eval(selector, el => el.open)) {
        await page.click(selector + ' > summary');
      }
    };
    const choose = async (selector, id) => {
      await page.click(selector);
      await page.waitForSelector(`[data-action="select-item"][data-item-id="${id}"]`, {visible:true});
      await page.click(`[data-action="select-item"][data-item-id="${id}"]`);
    };
    await visit('bedroom-starter');
    const bedroom = await page.evaluate(() => ({
      mon: window.__rigStudio.item('pioneer-dm40d'), routes: window.__rigStudio.connections(),
      pa: document.querySelector('.visual-pa').textContent,
      stage: document.querySelectorAll('.visual-stage').length,
      old: document.querySelectorAll('.rig-booth-stage, #zone-monitors, #zone-crowd-pa').length,
      labels: document.querySelector('.visual-monitor').textContent
    }));
    assert.equal(bedroom.stage, 1); assert.equal(bedroom.old, 0);
    assert.match(bedroom.pa, /Add Crowd PA/); assert.match(bedroom.labels, /2 cabinets/);
    assert.equal(bedroom.mon.connection.topology, 'master_slave');
    assert.match(bedroom.mon.connection.note, /passive.*supplied speaker cord/i);
    assert.equal(bedroom.routes.length, 1); assert.equal(bedroom.routes[0].kind, 'included');
    console.log('PASS: bedroom pair has included cable and master/passive topology; no PA');

    await visit('mobile-pro');
    assert.equal(await page.$$eval('.visual-pa .visual-images img', a => a.length), 1, 'mono PA is one cabinet');
    await choose('.visual-monitor .visual-pick', 'yamaha-hs5');
    const hs = await page.evaluate(() => window.__rigStudio.item('yamaha-hs5'));
    assert.equal(hs.connection.topology, 'independent'); assert.equal(hs.speaker_units, 2);
    assert.match(hs.connection.note, /own signal cable.*own power socket/);
    // Count a second PA via the actual shopping quantity stepper.
    await ensureOpen('#rig-shopping');
    const paSlot = await page.$eval('.visual-pa .visual-own', el => el.dataset.slotId);
    await page.click(`#rig-shopping [data-action="step-qty"][data-step="1"][data-slot-id="${paSlot}"]`);
    assert.equal(await page.$$eval('.visual-pa .visual-images img', a => a.length), 2);
    // Verify the PA swap from the shopping list obeys the same role gate.
    await page.click(`#rig-shopping [data-action="pick"][data-slot-id="${paSlot}"]`);
    assert.ok(await page.$('[data-item-id="jbl-eon-715"][data-action="select-item"]'));
    assert.equal(await page.$('[data-item-id="yamaha-hs5"][data-action="select-item"]'), null);
    assert.equal(await page.$('[data-item-id="krk-rokit-5-g4"][data-action="select-item"]'), null);
    await page.click('.picker-close');
    let routes = await page.evaluate(() => window.__rigStudio.connections());
    assert.equal(routes.length, 2); assert.match(routes[0].outputLabel, /master/i); assert.match(routes[1].outputLabel, /booth/i);
    assert.equal(routes[0].conflict, false); assert.equal(routes[1].conflict, false);
    await page.click('.visual-route-link');
    assert.equal(await page.$eval('#rig-connections', el => el.open), true);
    assert.equal(await page.$eval('#rig-shopping', el => el.open), true, 'route details must not collapse Shopping');
    // A missing cable must never animate as an established route.
    const monitor = await page.$eval('.cable-route-card--monitors', el => ({text:el.textContent, dots:el.querySelectorAll('.signal-dot').length}));
    if (/Cable needed/.test(monitor.text)) assert.equal(monitor.dots, 0);
    console.log('PASS: independent HS5, two PA cabinets, distinct PRIME 4+ master/booth routes and role-gated shopping swap');

    await visit('bedroom-starter');
    await choose('.visual-pa .visual-pick', 'jbl-eon-715');
    assert.match(await page.$eval('.visual-route', el => el.textContent), /limitation/i);
    await page.click('.visual-route-link');
    const conflict = await page.$eval('.cable-route-card--conflict', el => ({text:el.textContent, dots:el.querySelectorAll('.signal-dot').length}));
    assert.match(conflict.text, /cannot feed both Crowd PA and DJ Monitors independently/i);
    assert.match(conflict.text, /Ways to explore/i); assert.equal(conflict.dots, 0);
    assert.match(await page.$eval('#rs-compatibility', el => el.textContent), /Secondary Speaker Route Cannot Be Fed/i);
    console.log('PASS: FLX4 two-zone limitation is visible, no false route animation');

    await visit('club-ready');
    await choose('.visual-pa .visual-pick', 'jbl-eon-715');
    await page.click('.visual-monitor .visual-own');
    await ensureOpen('#rig-shopping');
    const newPaSlot = await page.$eval('.visual-pa .visual-own', el => el.dataset.slotId);
    await page.click(`#rig-shopping [data-action="step-qty"][data-step="1"][data-slot-id="${newPaSlot}"]`);
    const initial = await page.evaluate(() => ({state:window.__rigStudio.state(), cost:window.__rigStudio.cost(), url:window.__rigStudio.shareUrl()}));
    assert.equal(initial.state.items.find(s => s.itemId === 'yamaha-hs5').owned, true);
    assert.equal(initial.state.items.find(s => s.itemId === 'jbl-eon-715').qty, 2);
    assert.ok(initial.cost.ownedSavings >= 398);
    await ensureOpen('#rig-manage');
    await page.click('[data-action="save-rig"]');
    assert.match(await page.evaluate(() => localStorage.getItem('offbeat.rigs.saved')), /Two-zone test/);
    await visit('bedroom-starter');
    await ensureOpen('#rig-manage');
    await page.click('[data-action="load-saved-rig"][data-index="0"]');
    assert.equal(await page.evaluate(() => window.__rigStudio.state().items.find(s => s.itemId === 'jbl-eon-715').qty), 2, 'saved build reloads its quantity');
    assert.equal(await page.evaluate(() => window.__rigStudio.cost().buyTotal), initial.cost.buyTotal);
    await page.goto(initial.url, {waitUntil:'networkidle0'});
    const restored = await page.evaluate(() => ({state:window.__rigStudio.state(), cost:window.__rigStudio.cost()}));
    assert.equal(restored.state.items.find(s => s.itemId === 'yamaha-hs5').owned, true);
    assert.equal(restored.state.items.find(s => s.itemId === 'jbl-eon-715').qty, 2);
    assert.equal(restored.cost.buyTotal, initial.cost.buyTotal);
    assert.equal(await page.$$eval('.visual-pa .visual-images img', a => a.length), 2);
    await page.setViewport({width:390,height:844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: quantities, ownership, save and share restore; no mobile overflow');
    await context.close();
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
