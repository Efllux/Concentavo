import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {followPointAt,gradualScroll} from '../src/score-follow.js';

const anchors=[{beat:0,x:100,y:10,system:1},{beat:4,x:300,y:10,system:1},{beat:8,x:50,y:300,system:2}];
assert.equal(followPointAt(anchors,2).x,200,'Follow advances during sustained notes');
assert.equal(followPointAt(anchors,6).y,10,'Keep the current system visible before a line break');
assert.ok(followPointAt(anchors,7.5).y>10,'Bring the next system in before the line ends');
assert.equal(followPointAt(anchors,0).x,100,'A repeat can return to the first note');
assert.equal(followPointAt([],0),null);
assert.equal(gradualScroll(50,800,0),50,'A zero-length tick does not move');
assert.ok(gradualScroll(0,800,25)<80,'Resuming follow eases into position');
assert.equal(gradualScroll(0,800,25,false,500),12.5,'Catch-up movement has a bounded speed');
assert.equal(gradualScroll(0,800,25,true),800,'Respect reduced-motion preference');

const attrs='<attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>';
const words=['Christmas','singing','together','joyfully','everyone','celebrates','peaceful','evening'];
const xml=`<score-partwise><work><work-title>Lyric spacing</work-title></work><part-list><score-part id="S"><part-name>Soprano</part-name></score-part></part-list><part id="S">${Array.from({length:20},(_,bar)=>`<measure number="${bar+1}">${bar===0?attrs+'<direction><sound tempo="120"/></direction>':''}${words.map((word,i)=>`<note><pitch><step>${['C','D','E','F'][i%4]}</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type>${[1,2,3,4].map(verse=>`<lyric number="${verse}"><syllabic>single</syllabic><text>${word}</text></lyric>`).join('')}</note>`).join('')}</measure>`).join('')}</part></score-partwise>`;
const macChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(!existsSync(chromium.executablePath())&&process.platform==='darwin'&&existsSync(macChrome)?macChrome:undefined);
const browser=await chromium.launch({executablePath,headless:true});
try{
 const page=await browser.newPage({viewport:{width:2560,height:1440}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(pathToFileURL(resolve('dist/index.html')).href);await page.waitForSelector('#file-input',{state:'attached'});
 await page.locator('[data-open]').first().click();await page.waitForSelector('#score svg');assert.ok(parseInt(await page.locator('#zoom-label').textContent())>120,'Ordinary notation grows on a large screen');await page.locator('#back-library').click();
 await page.locator('#file-input').setInputFiles({name:'lyric-spacing.musicxml',mimeType:'application/xml',buffer:Buffer.from(xml)});
 await page.locator('#confirm-import').click();await page.locator('.track-title').last().click();await page.waitForSelector('#score svg');
 const inspect=()=>page.evaluate(()=>{
  const viewport=document.querySelector('#score-viewport'),lyrics=[...document.querySelectorAll('#score .lyrics text')].map(e=>({text:e.textContent,...e.getBoundingClientRect().toJSON()})),collisions=[];
  const rows=new Map();for(const word of lyrics){const key=Math.round(word.top/3);if(!rows.has(key))rows.set(key,[]);rows.get(key).push(word);}
  for(const row of rows.values()){row.sort((a,b)=>a.left-b.left);for(let i=1;i<row.length;i++)if(row[i-1].right>row[i].left+.75)collisions.push([row[i-1].text,row[i].text]);}
  return {width:viewport.clientWidth,height:viewport.clientHeight,svgHeight:document.querySelector('#score svg').getBoundingClientRect().height,lyricHeight:lyrics[0]?.height,collisions,outerWidth:document.documentElement.scrollWidth,outerHeight:document.documentElement.scrollHeight,follow:document.querySelector('#follow').getBoundingClientRect().toJSON()};
 });
 const desktop=await inspect();assert.ok(desktop.width>1700,'Large player fills the work surface');assert.ok(desktop.lyricHeight>18,'Dense lyrics remain readable on a large screen');assert.deepEqual(desktop.collisions,[],'Desktop lyrics do not overlap');
 await mkdir('test-results',{recursive:true});await page.mouse.move(0,0);await page.screenshot({path:'test-results/score-large.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('#score-viewport').clientWidth>370);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const phone=await inspect();assert.deepEqual(phone.collisions,[],'Dense multi-verse lyrics do not overlap on a phone');assert.equal(phone.outerWidth,390);assert.equal(phone.outerHeight,844);assert.ok(phone.lyricHeight>10,'Dense bars retain readable text');
 await page.screenshot({path:'test-results/score-narrow.png'});
 await page.setViewportSize({width:844,height:390});await page.locator('#score-flow').selectOption('horizontal');await page.waitForFunction(()=>!document.querySelector('#score-part').disabled);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const landscape=await inspect();assert.ok(landscape.width>820,'Landscape uses the whole width');assert.ok(landscape.follow.width>=16,'Follow is directly accessible in landscape');assert.ok(landscape.svgHeight<=landscape.height+1&&landscape.svgHeight>landscape.height*.85,'Every verse fits a readable sideways strip height');assert.deepEqual(landscape.collisions,[],'Sideways lyrics do not overlap');
 await page.screenshot({path:'test-results/score-sideways.png'});
 await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#play').textContent==='Ⅱ');
 const motion=await page.evaluate(()=>new Promise(resolve=>{
  const vp=document.querySelector('#score-viewport'),start=performance.now(),samples=[];
  function sample(){samples.push({x:vp.scrollLeft,t:performance.now(),cursor:document.querySelector('#score img')?.getBoundingClientRect().right-vp.getBoundingClientRect().left});if(performance.now()-start<6500)requestAnimationFrame(sample);else resolve({samples,width:vp.clientWidth});}sample();
 }));
 const moved=motion.samples.filter((s,i)=>i&&s.x>motion.samples[i-1].x);
 assert.ok(moved.length>100,'Sideways following moves through phrases continuously');
 assert.ok(moved[0].cursor<motion.width*.75,'Following starts before the text reaches the screen edge');
 const steps=motion.samples.slice(1).map((s,i)=>({distance:s.x-motion.samples[i].x,elapsed:s.t-motion.samples[i].t}));
 console.log('Follow motion:',JSON.stringify({movingFrames:moved.length,maxStep:Math.max(...steps.map(s=>s.distance)),delayedFrames:steps.filter(s=>s.elapsed>50).length}));
 assert.ok(steps.every(s=>s.distance<motion.width*.12*Math.max(1,s.elapsed/34)),'Playback does not jump a screen at the edge, allowing for delayed rendering frames');
 const manual=await page.locator('#score-viewport').evaluate(vp=>{vp.dispatchEvent(new WheelEvent('wheel',{deltaX:100}));vp.scrollLeft+=100;return vp.scrollLeft;});
 await page.waitForTimeout(600);assert.equal(await page.locator('#score-viewport').evaluate(e=>e.scrollLeft),manual,'Manual scrolling temporarily pauses following');
 await page.waitForTimeout(3650);await page.waitForFunction(x=>Math.abs(document.querySelector('#score-viewport').scrollLeft-x)>5,manual);
 await page.locator('#follow').uncheck();const stopped=await page.locator('#score-viewport').evaluate(e=>e.scrollLeft);await page.waitForTimeout(4300);assert.equal(await page.locator('#score-viewport').evaluate(e=>e.scrollLeft),stopped,'Turning Follow off stays off after four seconds');
 await page.locator('#follow').check();await page.waitForFunction(x=>Math.abs(document.querySelector('#score-viewport').scrollLeft-x)>5,stopped);await page.locator('#play').click();
 assert.deepEqual(errors,[]);console.log('PASS: wide player, dense multi-verse lyrics, landscape controls, gradual following, manual pause and explicit off.');
}finally{await browser.close();}
