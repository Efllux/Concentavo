import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const macChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(!existsSync(chromium.executablePath())&&process.platform==='darwin'&&existsSync(macChrome)?macChrome:undefined);
const browser=await chromium.launch({executablePath,headless:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(30000);
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await page.waitForSelector('.track-row');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No mobile horizontal overflow');
  assert.ok(await page.locator('.track-row').first().evaluate(el=>el.getBoundingClientRect().top<=204),'Leader enters the piece list by 204px on a phone');
  assert.ok(await page.locator('#import').isVisible()&&await page.locator('#library-bar #search').isVisible()&&await page.locator('#library-bar #folder-tabs').isVisible(),'Phone leader header and bar keep Import, search and the folders');
  assert.ok(await page.locator('#export-project').isVisible(),'Export remains a named phone action');
  assert.equal(await page.locator('.piece-select').first().isVisible(),false,'Checkboxes are hidden until Select');
  await page.locator('#library-select').click();assert.ok(await page.locator('.piece-select').first().isVisible(),'Select exposes row checkboxes');await page.locator('#library-select').click();
  await page.locator('#folder-tabs summary').click();
  assert.ok(await page.locator('#folder-tabs [data-folder]').first().isVisible(),'Phone folder selector reveals the full names');assert.ok(await page.locator('#folder-tabs [data-folder]').count()>=2&&await page.locator('#folder-tabs #add-folder').isVisible(),'Folder selector exposes the complete list and New folder');await page.keyboard.press('Escape');
  await page.locator('.room-menu > summary').click();
  for(const id of ['#language','#theme','#help','#edit-project'])assert.ok(await page.locator(`.room-menu-body ${id}`).isVisible(),`Phone room menu keeps ${id} reachable`);
  await page.locator('.room-menu > summary').click();
  await page.locator('[data-open]').first().click();
  await page.waitForSelector('#score svg');
  assert.ok(parseInt(await page.locator('#zoom-label').textContent())>=78&&parseInt(await page.locator('#zoom-label').textContent())<=100,'Phone score opens at a readable staff scale');
  // On phones the part buttons choose what is shown and heard; the Show list is desktop-only.
  assert.equal(await page.locator('#score-part').isVisible(),false,'Phone has one part control, not two');
  assert.equal(await page.locator('.part-picker > summary').isVisible(),false,'Before a part is chosen, the inline chooser is the only part control');
  await page.locator('[data-first-part]').nth(1).click();
  await page.waitForFunction(()=>{const s=document.querySelector('#score-part');return !s.disabled&&s.value===document.querySelectorAll('[data-practise]')[1].dataset.practise;});
  assert.equal(await page.locator('[data-practise]').nth(1).getAttribute('aria-pressed'),'true','Shown part is the part you practise');
  await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('concentavo-my-voice-'))localStorage.removeItem(key);});await page.reload();
  await page.waitForFunction(()=>{const s=document.querySelector('#score-part');return s&&!s.disabled&&s.value===document.querySelectorAll('[data-practise]')[1]?.dataset.practise;});
  assert.equal(await page.locator('[data-practise]').nth(1).getAttribute('aria-pressed'),'true','Earlier saved score-part choice restores as My part');
  assert.equal(await page.locator('.measure-hit').count(),16,'Single part retains every bar');
  await page.locator('#mobile-parts').click();await page.locator('[data-show="full"]').click();
  await page.waitForFunction(()=>!document.querySelector('#score-part').disabled&&document.querySelector('#score-part').value==='');
  assert.equal(await page.locator('[data-practise]').nth(1).getAttribute('aria-pressed'),'true','Full score keeps My part selected');
  await page.locator('[data-show="mine"]').click();await page.waitForFunction(()=>!document.querySelector('#score-part').disabled&&document.querySelector('#score-part').value===document.querySelectorAll('[data-practise]')[1].dataset.practise);await page.keyboard.press('Escape');
  assert.match(await page.locator('#tools-toggle').innerText(),/Repeat passage/,'Repeating is named on the closed phone deck');assert.equal(await page.locator('#speed').isVisible(),true,'Speed is directly visible');
  assert.equal(await page.locator('#mobile-parts span:not(.glyph)').innerText(),'More options','Advanced controls have a plain entry');
  assert.match(await page.locator('.part-picker > summary').innerText(),new RegExp(await page.locator('[data-practise]').nth(1).getAttribute('aria-label')),'The dock names the chosen part in full');
  await page.locator('.part-picker > summary').click();assert.equal(await page.locator('[data-practise][aria-pressed="true"] .part-check').isVisible(),true,'Part selection has a non-colour checkmark');await page.keyboard.press('Escape');
  assert.equal(await page.locator('#score-view').count(),0,'Mixer does not duplicate the score selector');
  // Loop and speed sit in the practice tools, one tap away on an upright phone.
  await page.locator('#mobile-parts').click();
  await page.locator('#bar-controls-button').click();
  await page.locator('#dialog-jump').fill('4');
  await page.locator('#dialog-go').click();
  assert.ok(Number(await page.locator('#seek').inputValue())>0,'Phone bar navigation works');const reading=await page.locator('#score-part').inputValue(),position=await page.locator('#seek').inputValue();await page.locator('#mobile-parts').click();await page.locator('#notation-size').click();assert.equal(await page.locator('#score-part').inputValue(),reading,'Notation size keeps the chosen voice');assert.equal(await page.locator('#seek').inputValue(),position,'Notation size keeps playback position');await page.locator('#zoom-fit').click();
  await page.locator('.part-picker > summary').click();await page.locator('[data-practise][aria-pressed="true"]').click();
  await page.waitForFunction(()=>{const s=document.querySelector('#score-part');return !s.disabled&&s.value==='';});
  await page.reload();await page.waitForSelector('#score svg');assert.equal(await page.locator('#score-part').inputValue(),'','Full-score choice survives refresh on a phone');
  await page.locator('#mobile-parts').click();
  const bounds=await page.evaluate(()=>({mixer:document.querySelector('.mixer').getBoundingClientRect().bottom,transport:document.querySelector('.dock').getBoundingClientRect().top,height:document.documentElement.scrollHeight,viewport:innerHeight}));
  assert.ok(bounds.mixer<=bounds.transport+1,'Phone mixer never covers transport controls');
  assert.equal(bounds.height,bounds.viewport,'Phone player fits viewport');
  await page.locator('[data-sheet-done=more]').click();
  await page.setViewportSize({width:844,height:390});
  await page.locator('.player-menu > summary').click();const landscapeMenu=await page.locator('.player-menu-body').boundingBox();assert.ok(landscapeMenu.y>=0&&landscapeMenu.y+landscapeMenu.height<=390,'Landscape settings stay inside the screen above the dock');assert.ok(await page.locator('.player-menu-body button').evaluateAll(es=>es.filter(e=>e.offsetWidth).every(e=>e.getBoundingClientRect().height>=44)),'Landscape settings keep 44px targets');await page.locator('#score-settings-button').click();await page.locator('#view-menu [data-flow="horizontal"]').click();await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#score-part').disabled);
  assert.notEqual(await page.locator('#score-part').inputValue(),'','Landscape phone chooses one readable part');
  assert.ok(await page.locator('#score-viewport').evaluate(e=>e.scrollWidth>e.clientWidth),'Landscape phone has a horizontal score strip');
  assert.ok(await page.locator('#mobile-parts').isVisible(),'Landscape phone keeps Parts reachable');
  assert.equal(await page.locator('.mixer').isVisible(),false,'Landscape mixer opens on demand');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),390,'Landscape player fits viewport');
  // Product owner (r14): Back sits top-left before the title, settings top-right, and Back is never right of Play; the score keeps most of the height.
  assert.ok(await page.locator('.player-heading').isVisible(),'Landscape shows the piece header');
  {const back=await page.locator('#back-library').boundingBox(),play=await page.locator('#play').boundingBox(),restart=await page.locator('#restart').boundingBox(),title=await page.locator('.player-heading h1').boundingBox(),gear=await page.locator('.player-menu > summary').boundingBox();
   assert.ok(back.x<title.x&&back.y<play.y&&back.x<=play.x,'Landscape Back is top-left, before the title and never right of Play');assert.ok(gear.x>title.x+title.width&&gear.y<play.y,'Landscape settings sit top-right');assert.ok(restart.x<play.x,'Restart comes before Play');}
  assert.ok(await page.locator('#score-viewport').evaluate(e=>e.getBoundingClientRect().height>=240),'Landscape gives the score at least 240px');
  await page.locator('#mobile-parts').click();
  assert.equal(await page.locator('.mixer').isVisible(),true,'Landscape mixer opens');
  console.log('PASS: phone score, bar navigation, part picker, and landscape sideways layout.');
}finally{await browser.close();}
