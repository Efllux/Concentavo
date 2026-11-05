import {chromium} from 'playwright';
import {build} from 'esbuild';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(!existsSync(chromium.executablePath())&&existsSync(chrome)?chrome:undefined);
const bundle=await build({entryPoints:['src/i18n.js'],bundle:true,format:'iife',globalName:'i18nTest',write:false});
const browser=await chromium.launch({executablePath,headless:true});
try{
 const page=await browser.newPage();await page.setContent('<title>Concentavo · Rehearsal rooms</title>');await page.addScriptTag({content:bundle.outputFiles[0].text});
 const result=await page.evaluate(()=>{
  const {translate}=window.i18nTest;
  const root=document.createElement('button');root.title='Playback settings';root.setAttribute('aria-label','Mute Alto');root.textContent='Save changes';translate(root,'nl');
  const input=document.createElement('input');input.placeholder='A message for your choir…';input.setAttribute('aria-label','Publish Soprano');translate(input,'nl');
  const dynamic=['Remove tag A cappella','Solo Alto','My part: none','Bar 12','Loop 9–12','1 piece imported.','3 pieces imported.','5 score parts · choose what appears online'].map(text=>translate(text,'nl'));
  const repeated=dynamic.map(text=>translate(text,'nl'));
  translate(document.querySelector('title'),'nl');
  return {root:{title:root.title,label:root.getAttribute('aria-label'),text:root.textContent},input:{placeholder:input.placeholder,label:input.getAttribute('aria-label')},dynamic,repeated,title:document.title,en:translate('Loop 9–12','en')};
 });
 assert.deepEqual(result.root,{title:'Afspeelinstellingen',label:'Alto dempen',text:'Wijzigingen opslaan'});
 assert.deepEqual(result.input,{placeholder:'Een bericht voor je koor…',label:'Soprano publiceren'});
 assert.deepEqual(result.dynamic,['Label A cappella verwijderen','Alto solo','Mijn partij: geen','Maat 12','Herhaal 9–12','1 stuk geïmporteerd.','3 stukken geïmporteerd.','5 partijen · kies wat online verschijnt']);
 assert.deepEqual(result.repeated,result.dynamic,'Repeated dynamic translation is stable');
 assert.equal(result.title,'Concentavo · Repetitieruimtes');assert.equal(result.en,'Loop 9–12');
 console.log('PASS: Dutch dynamic text, root attributes, template specificity, repeated updates and English source labels.');
}finally{await browser.close();}
