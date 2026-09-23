import { _electron as electron } from 'playwright';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const app=await electron.launch({args:['.','--user-data-dir='+resolve('test-results/desktop-profile')],env:{...process.env}});
try {
const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('.track-row');if(await page.locator('#try-example').count())await page.locator('#try-example').click();
assert.equal(await page.evaluate(()=>typeof window.require),'undefined','Renderer has no Node access');
assert.equal(await page.evaluate(()=>typeof window.choirloomDesktop.githubPublish),'function');
assert.equal((await page.evaluate(()=>window.choirloomDesktop.checkUpdates())).state,'development','Unpackaged builds identify update checks as development-only');
await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('update-status',{state:'ready',version:'1.1.0'}));
await page.locator('#help.update-ready').waitFor();await page.locator('#help').click();assert.match(await page.locator('#update-result').innerText(),/1\.1\.0 is ready/,'Automatic update status is visible in Help');await page.locator('dialog .dialog-actions button[value=cancel]').click();
await app.evaluate(({ipcMain})=>{
  let published=false;
  for(const channel of ['github-status','github-publish','github-site-status'])ipcMain.removeHandler(channel);
  ipcMain.handle('github-status',()=>({ok:true,value:{connected:true,login:'test-choir'}}));
  ipcMain.handle('github-publish',(_e,data)=>{if(!data.html.includes('score-partwise'))return {ok:false,error:'No score in export'};published=true;return {ok:true,value:{url:'https://test-choir.github.io/practice/',repo:'practice',updated:new Date().toISOString()}};});
  ipcMain.handle('github-site-status',()=>({ok:true,value:published?{url:'https://test-choir.github.io/practice/',repo:'practice',status:'built'}:null}));
});
await page.locator('#export-project').click();await page.waitForSelector('#github-target:not([hidden])');assert.equal(await page.locator('#publish-consent').count(),0,'Publishing has no redundant confirmation checkbox');assert.equal(await page.locator('#publish-now').isDisabled(),false);await page.locator('#publish-now').click();await page.waitForSelector('#github-link:not([hidden])');await page.waitForFunction(()=>document.querySelector('#github-progress')?.textContent.includes('online'),{},{timeout:15000});
await page.screenshot({path:'test-results/publish-desktop.png'});await page.locator('dialog .dialog-actions button[value=cancel]').click();assert.match(await page.locator('#export-project').innerText(),/Update/);
await page.locator('[data-open]').first().click();await page.waitForSelector('#score svg');
const cursor=page.locator('#score img').first();await cursor.waitFor();
const start=await cursor.getAttribute('style');await page.locator('#play').click();await page.waitForTimeout(500);const mid=await cursor.getAttribute('style');assert.equal(start,mid,'Cursor stays on sounding whole note');await page.waitForFunction(previous=>document.querySelector('#score img')?.getAttribute('style')!==previous,mid,{timeout:10000});const next=await cursor.getAttribute('style');assert.notEqual(mid,next,'Cursor advances to next note');await page.locator('#play').click();
await page.locator('#restart').click();await page.screenshot({path:'test-results/desktop-player.png'});
assert.deepEqual(errors,[]);await app.close();console.log('PASS: native app, isolated renderer, GitHub publish UI with mocked API, cursor timing and desktop launch.');

} finally { await app.close(); }
