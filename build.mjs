import { build } from 'esbuild';
import { mkdir,readFile,writeFile,readdir,rm } from 'node:fs/promises';
import { zipSync } from 'fflate';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
await mkdir('dist',{recursive:true});
// Include only checked-in source areas: never library data, credentials or local QA files.
const sources={};
async function collect(dir){
  for(const item of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,item.name);
    if(item.name==='generated-source.txt'||item.name.startsWith('.'))continue;
    if(item.isDirectory())await collect(path);
    else if(item.isFile())sources[path.replaceAll('\\','/')]=new Uint8Array(await readFile(path));
  }
}
for(const dir of ['src','desktop','scripts','tests','build','docs','.github','auth'])await collect(dir);
for(const file of ['package.json','package-lock.json','build.mjs','README.md','LICENSE','LICENSING.md','THIRD-PARTY-NOTICES.txt','CONTRIBUTING.md','CHANGELOG.md','.gitignore','.gitattributes'])sources[file]=new Uint8Array(await readFile(file));
await writeFile('src/generated-source.txt',Buffer.from(zipSync(sources,{level:9})).toString('base64'));
let result;
try { result=await build({entryPoints:['src/app.js'],bundle:true,minify:true,format:'iife',target:['chrome110','safari16','firefox115'],loader:{'.css':'text','.txt':'text','.mp3':'dataurl'},write:false,legalComments:'eof'});
} finally { await rm('src/generated-source.txt',{force:true}); }
const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const css=await readFile('src/style.css','utf8');
const webConfig=JSON.stringify({clientId:process.env.CONCENTAVO_GITHUB_CLIENT_ID||'',authUrl:process.env.CONCENTAVO_AUTH_URL||'',appSlug:process.env.CONCENTAVO_GITHUB_APP_SLUG||''}).replace(/</g,'\\u003c');
const html=`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Create and publish self-contained choir rehearsal websites"><meta name="theme-color" content="#f6f4f0"><title>Concentavo · Rehearsal rooms</title><link rel="manifest" href="./manifest.webmanifest"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%233257dd'/%3E%3Cpath d='M9 11v10M16 6v20M23 13v7' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E"><style>${css}</style></head><body><div id="app"><div class="loading-screen">Opening Concentavo…</div></div><dialog id="dialog"></dialog><div class="toast" id="toast" role="status" hidden></div><script id="boot-data" type="application/json">{}</script><script id="web-config" type="application/json">${webConfig}</script><script id="app-code">${script}</script></body></html>`;
await writeFile('dist/index.html',html);
const version=JSON.parse(await readFile('package.json','utf8')).version;
const webRevision=createHash('sha256').update(html).digest('hex').slice(0,12);
await writeFile('dist/manifest.webmanifest',JSON.stringify({name:'Concentavo',short_name:'Concentavo',description:'Create choir rehearsal websites',start_url:'./',scope:'./',display:'standalone',background_color:'#f6f4f0',theme_color:'#252532',icons:[{src:'./icon.png',sizes:'1024x1024',type:'image/png',purpose:'any'}]}));
await writeFile('dist/icon.png',await readFile('build/icon.png'));
await writeFile('dist/sw.js',`const CACHE='concentavo-web-${version}-${webRevision}';self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['./','./index.html','./icon.png','./manifest.webmanifest'])));self.skipWaiting();});self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('concentavo-web-')&&key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});self.addEventListener('fetch',event=>{const request=event.request;const url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||url.searchParams.has('code')||url.searchParams.has('state')||url.searchParams.has('error'))return;event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;}).catch(()=>caches.match(request).then(cached=>cached||caches.match('./index.html'))));});`);
await writeFile('dist/THIRD-PARTY-NOTICES.txt',await readFile('THIRD-PARTY-NOTICES.txt','utf8'));
console.log(`Built self-contained app (${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MB).`);
