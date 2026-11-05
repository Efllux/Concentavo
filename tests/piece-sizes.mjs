import { chromium } from 'playwright';
import {testBrowser} from './browser.mjs';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Very small and very large pieces, with few and many voices, on phones and desktop.
const steps=['C','D','E','F','G','A','B'];
const syllables='Al le lu ia glo ri a in ex cel sis De o'.split(' ');
function piece(title,parts,bars,{lyrics=true,piano=false}={}){
  const all=piano?[...parts,'Piano']:parts;
  const list=all.map((name,i)=>`<score-part id="P${i}"><part-name>${name}</part-name></score-part>`).join('');
  const body=all.map((name,i)=>{
    const instrument=name==='Piano',octave=instrument?3:[5,5,4,4,4,3,3,3][i%8];
    return `<part id="P${i}">${Array.from({length:bars},(_,b)=>`<measure number="${b+1}">${b===0?`<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>${octave<4?'F':'G'}</sign><line>${octave<4?4:2}</line></clef></attributes>`:''}${[0,1,2,3].map(n=>`<note><pitch><step>${steps[(b+n+i)%7]}</step><octave>${octave}</octave></pitch><duration>1</duration><type>quarter</type>${lyrics&&!instrument?`<lyric><text>${syllables[(b*4+n)%syllables.length]}</text></lyric>`:''}</note>`).join('')}</measure>`).join('')}</part>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${title}</work-title></work><part-list>${list}</part-list>${body}</score-partwise>`;
}
const pieces=[
  {file:'tiny.musicxml',title:'Tiny melody',xml:piece('Tiny melody',['Melody'],2,{lyrics:false}),voices:1},
  {file:'duet.musicxml',title:'Short duet',xml:piece('Short duet',['Soprano','Alto'],8),voices:2},
  {file:'satb.musicxml',title:'Chorale',xml:piece('Chorale',['Soprano','Alto','Tenor','Bass'],32),voices:4},
  {file:'large.musicxml',title:'Large double choir',xml:piece('Large double choir',['Soprano 1','Soprano 2','Alto 1','Alto 2','Tenor 1','Tenor 2','Bass 1','Bass 2'],240,{piano:true}),voices:9}
];

const macChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(!existsSync(chromium.executablePath())&&process.platform==='darwin'&&existsSync(macChrome)?macChrome:undefined);
const session=await testBrowser({executablePath,headless:true}),{browser}=session;
const report=[];
try{
  await mkdir('test-results',{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);await page.waitForSelector('.track-row');
  const before=await page.locator('.track-row').count();
  await page.locator('#file-input').setInputFiles(pieces.map(p=>({name:p.file,mimeType:'application/xml',buffer:Buffer.from(p.xml)})));
  await page.locator('#confirm-import').click();
  await page.waitForFunction(n=>document.querySelectorAll('.track-row').length===n,before+pieces.length);

  const settled=()=>page.waitForFunction(()=>{const vp=document.querySelector('#score-viewport'),s=document.querySelector('#score-part');return vp&&s&&!s.disabled&&!vp.dataset.pending&&document.querySelector('#score svg');});
  for(const p of pieces){
    for(const [label,w,h] of [['desktop',1280,900],['phone',390,844],['sideways',844,390]]){
      await page.setViewportSize({width:w,height:h});
      await page.goto(pathToFileURL(resolve('dist/index.html')).href);await page.waitForSelector('.track-row');
      const t0=Date.now();
      await page.getByRole('button',{name:p.title,exact:true}).click();await settled();
      const ms=Date.now()-t0;
      if(label!=='desktop'&&await page.locator('.part-picker > summary').count())await page.locator('.part-picker > summary').click();
      const shot=await page.evaluate(()=>{const vp=document.querySelector('#score-viewport'),deck=document.querySelector('.dock'),buttons=[...document.querySelectorAll('.part-chips button')].filter(b=>b.offsetParent);
        return {overflow:document.documentElement.scrollWidth>innerWidth+1,pageScroll:document.documentElement.scrollHeight>innerHeight+1,scoreShare:vp.clientHeight/innerHeight,deckBottom:deck.getBoundingClientRect().bottom,buttons:buttons.length,narrowest:Math.min(...buttons.map(b=>b.getBoundingClientRect().width)),clipped:buttons.some(b=>b.getBoundingClientRect().right>innerWidth+1),zoom:document.querySelector('#zoom-label')?.textContent};});
      await page.screenshot({path:`test-results/size-${p.file.split('.')[0]}-${label}.png`});
      report.push({piece:p.title,view:label,ms,...shot});
      assert.equal(shot.overflow,false,`${p.title} · ${label}: no sideways page overflow`);
      assert.equal(shot.pageScroll,false,`${p.title} · ${label}: player fits the screen`);
      assert.ok(shot.deckBottom<=h+1,`${p.title} · ${label}: playback controls stay on screen`);
      if(label!=='desktop'&&p.voices>1){
        assert.equal(shot.buttons,p.voices,`${p.title} · ${label}: one part button per part, piano included`);
        assert.equal(shot.clipped,false,`${p.title} · ${label}: part buttons fit the width`);
        assert.ok(shot.narrowest>=40,`${p.title} · ${label}: part buttons stay tappable (${Math.round(shot.narrowest)}px)`);
      }
      if(label==='phone')assert.ok(shot.scoreShare>.5,`${p.title} · phone: score keeps most of the screen (${shot.scoreShare.toFixed(2)})`);
    }
  }
  // Rotating a large piece engraves once after the size settles, and keeps the reading position.
  await page.setViewportSize({width:390,height:844});await page.goto(pathToFileURL(resolve('dist/index.html')).href);await page.waitForSelector('.track-row');
  await page.getByRole('button',{name:'Large double choir',exact:true}).click();await settled();
  await page.evaluate(()=>{window.__renders=0;new MutationObserver(()=>window.__renders++).observe(document.querySelector('#score'),{childList:true});});
  const r0=Date.now();for(const [w,h] of [[600,600],[760,450],[844,390]])await page.setViewportSize({width:w,height:h});await settled();await page.waitForTimeout(300);
  const rotate={ms:Date.now()-r0,renders:await page.evaluate(()=>window.__renders)};report.push({piece:'Large double choir',view:'rotate burst',...rotate});
  assert.ok(rotate.renders<=2,`A burst of sizes engraves at most once or twice (${rotate.renders})`);
  // Choir setting: the room's parts and singers reach the website, and a singer's choice opens each piece on the linked part.
  await page.setViewportSize({width:1280,height:900});await page.goto(pathToFileURL(resolve('dist/index.html')).href);await page.waitForSelector('.track-row');
  await page.locator('.room-menu > summary').click();await page.locator('#edit-project').click();
  await page.locator('#choir-parts').fill('Soprano 1\nSoprano 2\nAlto 1\nAlto 2\nTenor 1\nTenor 2\nBass 1\nBass 2');
  await page.locator('#choir-singers').fill('Anna: Alto 2\nBram: Tenor 1');
  await page.locator('#save-project').click();await page.waitForSelector('dialog[open]',{state:'detached'}).catch(()=>{});
  await page.locator('#export-project').click();const download=page.waitForEvent('download');await page.locator('#download-site').click();await (await download).saveAs('test-results/choir-site.zip');
  await writeFile('test-results/choir-site.html',strFromU8(unzipSync(await readFile('test-results/choir-site.zip'))['index.html']));
  const singer=await browser.newPage({viewport:{width:390,height:844}});singer.on('pageerror',e=>errors.push(e.message));
  await singer.goto(pathToFileURL(resolve('test-results/choir-site.html')).href);await singer.waitForSelector('#voice-pref');
  const choices=await singer.locator('#voice-pref option').allTextContents();
  assert.ok((await singer.locator('[data-my-part="Alto 2"]').count())===1&&choices.includes('Anna · Alto 2'),'Website offers the choir parts and named singers');
  await singer.locator('.room-part-picker > summary').click();await singer.locator('[data-my-part="Bass 1"]').click();
  assert.ok((await singer.locator('.part-availability.unavailable').count())>0,'Room marks pieces without the chosen part');
  await singer.locator('#voice-pref').selectOption('@Anna');
  await singer.getByRole('button',{name:'Large double choir',exact:true}).click();
  await singer.waitForFunction(()=>{const s=document.querySelector('#score-part');return s&&!s.disabled&&document.querySelector('#score svg');});
  const shownLarge=await singer.evaluate(()=>{const s=document.querySelector('#score-part');return s.options[s.selectedIndex].textContent;});
  assert.equal(shownLarge,'Alto 2','Anna opens the double-choir piece on Alto 2');
  assert.equal(await singer.locator('[data-practise][aria-pressed="true"]').getAttribute('aria-label'),'Alto 2','Alto 2 is the highlighted part button');
  await singer.locator('#back-library').click();await singer.waitForSelector('#voice-pref');
  assert.ok(await singer.evaluate(()=>[...document.querySelectorAll('.track-row')].every(r=>{const t=r.querySelector('.track-title').getBoundingClientRect(),o=r.querySelector('[data-open].small, .row-actions [data-open]')?.getBoundingClientRect();return !o||o.left>=t.right-1;})),'Singer list keeps titles left and Open on the right');
  assert.equal(await singer.locator('#voice-pref').inputValue(),'@Anna','The choice is remembered');
  await singer.getByRole('button',{name:'Chorale',exact:true}).click();
  await singer.waitForFunction(()=>{const s=document.querySelector('#score-part');return s&&!s.disabled&&document.querySelector('#score svg');});
  assert.equal(await singer.evaluate(()=>{const s=document.querySelector('#score-part');return s.options[s.selectedIndex].textContent;}),'Alto','Alto 2 falls back to Alto in a plain SATB piece');
  await singer.screenshot({path:'test-results/choir-singer-phone.png'});
  report.push({piece:'Choir setting',view:'singer phone',ms:0,buttons:await singer.locator('[data-practise]').count()});
  assert.deepEqual(errors,[],'No page errors');
  console.table(report.map(r=>({piece:r.piece,view:r.view,ms:r.ms,zoom:r.zoom??'',score:r.scoreShare?.toFixed?.(2)??'',buttons:r.buttons??'',narrowest:Number.isFinite(r.narrowest)?Math.round(r.narrowest):'',renders:r.renders??''})));
  console.log('PASS: tiny, duet, SATB and 8-voice 240-bar pieces on phone, sideways and desktop; rotation engraves once; choir parts and singers link pieces to the right part.');
}finally{await session.close();}
