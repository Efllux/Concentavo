import assert from 'node:assert/strict';
import {RoomSync} from '../src/room-sync.js';
import worker from '../auth/worker.js';

Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};};
const room=(id,title)=>({id,name:title,description:'',language:'en',folders:[],folderColors:{},tagColors:{},tracks:[{id:'piece-'+id,title:'Score',source:'<score-partwise/>',kind:'musicxml',score:{lanes:[],measures:[]},xml:'<score-partwise/>',visibility:'visible'}],trash:[],created:'2026-01-01'});

function fakeGitHub(){
  let exists=false,head='head-0',tree='tree-0',serial=0;
  const trees=new Map([['tree-0',new Map()]]),commits=new Map([['head-0','tree-0']]),blobs=new Map();
  return async(method,path,data)=>{
    if(path==='/repos/test/concentavo-library'){if(!exists)throw Object.assign(Error('missing'),{status:404});return {private:true};}
    if(path==='/user/repos'&&method==='POST'){assert.equal(data.private,true);exists=true;return {name:'concentavo-library'};}
    if(path.endsWith('/git/ref/heads/main')&&method==='GET')return {object:{sha:head}};
    if(path.endsWith('/git/refs/heads/main')&&method==='PATCH'){assert.equal(data.force,false);head=data.sha;return {};}
    if(path.includes('/git/commits/')&&method==='GET')return {tree:{sha:commits.get(path.split('/').at(-1))}};
    if(path.endsWith('/git/commits')&&method==='POST'){assert.deepEqual(data.parents,[head]);const id=`head-${++serial}`;commits.set(id,data.tree);return {sha:id};}
    if(path.includes('/git/trees/')&&method==='GET'){const current=trees.get(path.split('/').at(-1).split('?')[0]);return {truncated:false,tree:[...current].map(([file,content])=>{const sha='blob-'+Buffer.from(file).toString('hex');blobs.set(sha,content);return {path:file,type:'blob',sha};})};}
    if(path.endsWith('/git/blobs')&&method==='POST'){const sha=`uploaded-${++serial}`;blobs.set(sha,data.content);return {sha};}
    if(path.endsWith('/git/trees')&&method==='POST'){const next=new Map(trees.get(data.base_tree));for(const entry of data.tree)next.set(entry.path,blobs.get(entry.sha));const id=`tree-${++serial}`;trees.set(id,next);return {sha:id};}
    if(path.includes('/git/blobs/')&&method==='GET'){const content=blobs.get(path.split('/').at(-1));return {content:Buffer.from(content).toString('base64'),size:Buffer.byteLength(content)};}
    throw Error(`Unhandled fake GitHub request: ${method} ${path}`);
  };
}
const api=fakeGitHub();
let first={projects:[room('a','First')]},second={projects:[room('demo','Example')]};
const firstSync=new RoomSync({api,getLibrary:()=>first,replaceLibrary:async value=>{first=value;},onStatus:()=>{},storage:storage()});
firstSync.user={login:'test'};await firstSync.enable();
assert.equal(firstSync.meta.enabled,true,'Private sync is enabled explicitly');
const secondSync=new RoomSync({api,getLibrary:()=>second,replaceLibrary:async value=>{second=value;},onStatus:()=>{},storage:storage()});
await secondSync.connect({login:'test'},{fresh:true});
assert.deepEqual(second.projects.map(item=>item.id),['a'],'A fresh browser replaces its demo room with cloud rooms');
assert.equal(second.projects[0].tracks[0].source,'<score-partwise/>','A second device gets the editable source score');
first.projects[0].name='Edited on first';await firstSync.syncNow();
second.projects[0].name='Edited on second';await secondSync.syncNow();
assert.equal(second.projects.find(item=>item.id==='a').name,'Edited on first','Remote version is retained');
assert.ok(second.projects.some(item=>item.name==='Edited on second (conflict copy)'),'Concurrent local edit remains as a copy');
assert.equal(secondSync.meta.conflictCount,1,'Conflict stays flagged until reviewed');
secondSync.acknowledgeConflicts();assert.equal(secondSync.meta.conflictCount,0);
clearTimeout(firstSync.timer);clearTimeout(secondSync.timer);

const env={ALLOWED_ORIGIN:'https://efllux.github.io',GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'test-secret',REDIRECT_URI:'https://efllux.github.io/Concentavo/'};
const originalFetch=globalThis.fetch;globalThis.fetch=async(_url,options)=>{assert.equal(options.body.get('client_secret'),'test-secret');assert.equal(options.body.get('code_verifier'),'a'.repeat(43));return new Response(JSON.stringify({access_token:'ghu_example',expires_in:3600}),{headers:{'Content-Type':'application/json'}});};
try{
  const request=new Request('https://concentavo-auth.example/oauth/exchange',{method:'POST',headers:{Origin:'https://efllux.github.io','Content-Type':'application/json'},body:JSON.stringify({code:'abcdef0123456789',codeVerifier:'a'.repeat(43)})});
  const response=await worker.fetch(request,env);assert.equal(response.status,200);assert.equal((await response.json()).token,'ghu_example');
  const denied=await worker.fetch(new Request('https://concentavo-auth.example/oauth/exchange',{method:'POST',headers:{Origin:'https://bad.example','Content-Type':'application/json'},body:'{}'}),env);assert.equal(denied.status,403);
}finally{globalThis.fetch=originalFetch;}
console.log('PASS: private room sync, second-device load, conflict preservation, and isolated OAuth token exchange.');
