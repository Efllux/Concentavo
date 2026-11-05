import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(!existsSync(chromium.executablePath())&&existsSync(chrome)?chrome:undefined);
const browser=await chromium.launch({executablePath,headless:true});
try{
 const page=await browser.newPage();await page.setContent('<div class="mixer"><div class="voice"><div class="voice-name"><button class="focus-toggle" aria-pressed="true">My part</button></div></div></div><div id="follow-resume"><strong>Resume</strong></div>');await page.addStyleTag({content:await readFile('src/style.css','utf8')});
 const ratios=await page.evaluate(()=>{
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),voice=document.querySelector('.voice'),button=document.querySelector('button');
  const luminance=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,1,1);const rgb=[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  const rows=[];for(const theme of ['light','dark']){document.documentElement.dataset.theme=theme;for(let i=0;i<6;i++){voice.style.setProperty('--part',`var(--part-${i})`);const c=getComputedStyle(button),a=luminance(c.color),b=luminance(c.backgroundColor);rows.push({theme,part:i,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)});}const resume=getComputedStyle(document.querySelector('#follow-resume strong')),a=luminance(resume.color),b=luminance(resume.backgroundColor);rows.push({theme,part:'Resume',ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)});}return rows;
 });
 for(const row of ratios)assert.ok(row.ratio>=4.5,`${row.theme} part ${row.part}: ${row.ratio.toFixed(2)}:1`);
 console.log(`PASS: all six part-button colours and Resume in both themes meet 4.5:1 (minimum ${Math.min(...ratios.map(r=>r.ratio)).toFixed(2)}:1).`);
}finally{await browser.close();}
