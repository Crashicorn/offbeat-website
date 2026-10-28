// Run with a local site server. Uses existing Puppeteer/Chromium; installs nothing.
// PUPPETEER_MODULE=/path/to/puppeteer-core BROWSER_EXECUTABLE=/path/to/chrome node tests/standalone-guides-chromium.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const pages = ['denon-sc6000-review.html', 'denon-prime-go-review.html', 'xdj-az-vs-denon-prime-4-plus.html', 'best-standalone-dj-systems.html'];
(async () => {
 const browser = await puppeteer.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-sandbox','--disable-gpu']});
 const results = [];
 try {
  for (const width of [390,1440]) for (const file of pages) {
   const page = await browser.newPage(); const errors=[]; const failed=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
   page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`)});
   await page.setViewport({width,height:1000,deviceScaleFactor:1});
   const response=await page.goto(`${process.env.BASE_URL||'http://127.0.0.1:8973'}/${file}`,{waitUntil:'networkidle0'});
   assert.equal(response.status(),200);
   await page.evaluate(async()=>{for(const img of document.images){img.loading='eager';try{await img.decode()}catch{}}});
   const facts=await page.evaluate(()=>{
    const schemas=[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent));
    const faq=schemas.find(s=>s['@type']==='FAQPage');
    const visible=[...document.querySelectorAll('.faq-section details')].map(d=>({q:d.querySelector('summary').textContent.trim(),a:d.querySelector('p').textContent.trim()}));
    return {h1:document.querySelectorAll('h1').length,overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),visible,schema:faq.mainEntity.map(e=>({q:e.name,a:e.acceptedAnswer.text})),text:document.querySelector('main').textContent,links:[...document.querySelectorAll('main a[href]')].map(a=>a.getAttribute('href')).filter(h=>!/^https?:|^mailto:|^#/.test(h))};
   });
   assert.equal(facts.h1,1); assert.equal(facts.overflow,false,`${file} ${width} page overflow`);
   assert.deepEqual(facts.brokenImages,[]); assert.deepEqual(facts.schema,facts.visible,`${file} FAQ mismatch`);
   assert.deepEqual(errors,[]); assert.deepEqual(failed,[]);
   for(const link of facts.links)assert.ok(fs.existsSync(path.resolve(__dirname,'..',link.split(/[?#]/)[0])),`Missing local target ${link}`);
   if(file==='denon-sc6000-review.html'){
    assert.match(facts.text,/separate mixer/); assert.match(facts.text,/does not itself unlock Serato DJ Pro/);assert.match(facts.text,/three USB-A drive ports/);
    assert.doesNotMatch(facts.text,/12\.1|Engine DJ Pro|0% skipping|~\$1,799|7\.2 lbs/);
   }
   if(file==='denon-prime-go-review.html')assert.match(facts.text,/Apple Music and Amazon Music Unlimited are listed for GO\+, not original GO/);
   if(file==='xdj-az-vs-denon-prime-4-plus.html')assert.match(facts.text,/PRIME 4\+ has XLR booth outputs/);
   const summaries=await page.$$('.faq-section summary');
   for(const summary of summaries){await summary.evaluate(e=>e.scrollIntoView({block:'center'}));const wasOpen=await summary.evaluate(e=>e.parentElement.open);await summary.focus();await page.keyboard.press('Enter');assert.equal(await summary.evaluate(e=>e.parentElement.open),!wasOpen);}
   if(process.env.EVIDENCE_DIR){fs.mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.EVIDENCE_DIR,`${file}-${width}.png`),fullPage:true});}
   results.push({file,width,status:200,faqCount:summaries.length,overflow:false,brokenImages:0,pageErrors:errors,failedResponses:failed});
   await page.close();
  }
  console.log(JSON.stringify({browser:await browser.version(),results},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
