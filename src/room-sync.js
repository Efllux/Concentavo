// Optional, browser-side sync. GitHub holds editable data; the auth helper never sees it.
const repositoryName='concentavo-library';
const markerPath='.concentavo-library.json';
const metaKey='concentavo-sync-v1';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const decode=content=>new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\s/g,'')),c=>c.charCodeAt(0)));
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
async function fingerprint(room){const bytes=new TextEncoder().encode(JSON.stringify(room));const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');}
function filesFor(rooms){
  const files=new Map([[markerPath,JSON.stringify({format:'concentavo-library',version:1})]]);
  for(const room of rooms){
    if(!validId(room.id))throw Error('A room has an invalid identifier for GitHub sync.');
    const {tracks,trash,...metadata}=room;
    files.set(`rooms/${room.id}/room.json`,JSON.stringify({...metadata,trackIds:tracks.map(t=>t.id),trashIds:(trash||[]).map(t=>t.id)}));
    for(const piece of [...tracks,...(trash||[])]){
      if(!validId(piece.id))throw Error('A score has an invalid identifier for GitHub sync.');
      files.set(`rooms/${room.id}/scores/${piece.id}.json`,JSON.stringify(piece));
    }
  }
  return files;
}
function roomsFrom(files){
  const rooms=[];
  for(const [path,content] of files){
    if(!/^rooms\/[a-zA-Z0-9_-]{1,100}\/room\.json$/.test(path))continue;
    const raw=JSON.parse(content),{trackIds,trashIds,...metadata}=raw;
    const load=id=>{if(!validId(id))throw Error('Invalid score identifier in the cloud library.');const value=files.get(`rooms/${metadata.id}/scores/${id}.json`);if(!value)throw Error(`A synced score is missing from ${metadata.name}.`);return JSON.parse(value);};
    if(!validId(metadata.id)||!Array.isArray(trackIds)||!Array.isArray(trashIds))throw Error('Invalid room data in the cloud library.');
    rooms.push({...metadata,tracks:trackIds.map(load),trash:trashIds.map(load)});
  }
  return rooms;
}
async function refAndTree(api,owner,branch){
  const base=`/repos/${owner}/${repositoryName}`;
  let ref;for(let i=0;i<5;i++){try{ref=await api('GET',`${base}/git/ref/heads/${encodeURIComponent(branch)}`);break;}catch(error){if(error.status!==404||i===4)throw error;await sleep(900);}}
  const commit=await api('GET',`${base}/git/commits/${ref.object.sha}`);
  return {base,head:ref.object.sha,tree:commit.tree.sha};
}
async function readFiles(api,state){
  const response=await api('GET',`${state.base}/git/trees/${state.tree}?recursive=1`);
  if(response.truncated)throw Error('The cloud library is too large to load safely. Download it from GitHub and contact support.');
  const entries=response.tree.filter(entry=>entry.type==='blob'&&(entry.path===markerPath||/^rooms\/[a-zA-Z0-9_-]{1,100}\/(room\.json|scores\/[a-zA-Z0-9_-]{1,100}\.json)$/.test(entry.path)));
  const files=new Map();
  for(let offset=0;offset<entries.length;offset+=2){
    await Promise.all(entries.slice(offset,offset+2).map(async entry=>{const blob=await api('GET',`${state.base}/git/blobs/${entry.sha}`);if(blob.size>90_000_000)throw Error('A synced score is too large to open in the browser.');files.set(entry.path,decode(blob.content));}));
  }
  return files;
}
function conflictCopy(room,existingIds){
  const copy=structuredClone(room);
  copy.id=crypto.randomUUID();copy.name=`${room.name} (conflict copy)`;delete copy.published;
  for(const piece of [...copy.tracks,...(copy.trash||[])])piece.id=crypto.randomUUID();
  while(existingIds.has(copy.id))copy.id=crypto.randomUUID();
  return copy;
}
export class RoomSync {
  constructor({api,getLibrary,replaceLibrary,onStatus,storage=localStorage}){
    this.api=api;this.getLibrary=getLibrary;this.replaceLibrary=replaceLibrary;this.onStatus=onStatus;
    this.storage=storage;try{this.meta=JSON.parse(storage.getItem(metaKey)||'{}');}catch{this.meta={};}
    this.files=new Map();this.head=null;this.timer=null;this.running=null;this.user=null;this.resyncAfter=false;
  }
  get enabled(){return !!(this.meta.enabled&&this.user&&this.meta.owner===this.user.login);}
  status(state,message=''){if(state==='current'&&this.meta.conflictCount){state='conflict';message=`${this.meta.conflictCount} room conflict ${this.meta.conflictCount===1?'copy needs':'copies need'} review.`;}this.onStatus({state,message,updated:this.meta.updated||null,enabled:this.enabled,user:this.user?.login||''});}
  remember(){this.storage.setItem(metaKey,JSON.stringify(this.meta));}
  acknowledgeConflicts(){this.meta.conflictCount=0;this.remember();this.status('current');}
  async connect(user,{fresh=false}={}){
    this.user=user;
    this.status('checking');
    try{
      let repository;try{repository=await this.api('GET',`/repos/${user.login}/${repositoryName}`);}catch(error){if(error.status!==404)throw error;}
      if(!repository){this.meta.enabled=false;this.remember();this.status('available');return false;}
      if(!repository.private)throw Error('The concentavo-library repository exists but is public. Make it private before enabling sync.');
      const branch=repository.default_branch||'main';
      const remote=await refAndTree(this.api,user.login,branch),files=await readFiles(this.api,remote);
      const marker=JSON.parse(files.get(markerPath)||'null');
      if(marker?.format!=='concentavo-library')throw Error('The concentavo-library repository is not a Concentavo data repository. Rename it before enabling sync.');
      this.head=remote.head;this.files=files;
      this.meta={...this.meta,enabled:true,owner:user.login,branch,baseline:this.meta.owner===user.login?this.meta.baseline||{}:{}};
      await this.mergeRemote(roomsFrom(files),{fresh});this.remember();this.status('current');this.schedule();return true;
    }catch(error){this.status('error',error.message);throw error;}
  }
  async enable(){
    if(!this.user)throw Error('Sign in to GitHub first.');
    if(this.enabled){this.schedule();return;}
    this.status('syncing');
    try{
      const repository=await this.api('POST','/user/repos',{name:repositoryName,description:'Private editable Concentavo rehearsal rooms',private:true,auto_init:true});
      this.meta={enabled:true,owner:this.user.login,branch:repository.default_branch||'main',baseline:{}};this.head=null;this.files=new Map();this.remember();
      await this.syncNow();
    }catch(error){this.status('error',error.message);throw error;}
  }
  async mergeRemote(remoteRooms,{fresh=false}={}){
    const library=this.getLibrary(),local=fresh&&remoteRooms.length?[]:library.projects;
    const byId=new Map(local.map(room=>[room.id,room])),merged=[...local],conflicts=[];
    const baseline=this.meta.baseline||{},nextBaseline={};
    for(const remote of remoteRooms){
      const remoteHash=await fingerprint(remote),original=byId.get(remote.id),index=merged.findIndex(room=>room.id===remote.id);
      nextBaseline[remote.id]=remoteHash;
      if(!original){merged.push(remote);continue;}
      const localHash=await fingerprint(original),previous=baseline[remote.id];
      if(localHash===remoteHash)continue;
      if(previous&&remoteHash===previous)continue;
      if(previous&&localHash===previous){merged[index]=remote;continue;}
      const copy=conflictCopy(original,new Set(merged.map(room=>room.id)));conflicts.push(copy.name);merged[index]=remote;merged.push(copy);
    }
    this.meta.baseline={...baseline,...nextBaseline};
    if(JSON.stringify(merged)!==JSON.stringify(library.projects))await this.replaceLibrary({...library,projects:merged});
    if(conflicts.length){this.meta.conflictCount=(this.meta.conflictCount||0)+conflicts.length;this.status('conflict',`${conflicts.length} room conflict ${conflicts.length===1?'copy was':'copies were'} kept. Review them before publishing.`);}
  }
  schedule(){if(!this.enabled)return;if(this.running){this.resyncAfter=true;return;}clearTimeout(this.timer);this.status(navigator.onLine?'pending':'offline');if(navigator.onLine)this.timer=setTimeout(()=>this.syncNow().catch(()=>{}),1800);}
  async syncNow(){
    if(!this.enabled)throw Error('Enable GitHub sync first.');
    if(this.running)return this.running;
    this.running=this.flush().finally(()=>{this.running=null;if(this.resyncAfter){this.resyncAfter=false;this.schedule();}});return this.running;
  }
  async flush(){
    if(!navigator.onLine){this.status('offline');return;}
    this.status('syncing');
    try{
      const state=await refAndTree(this.api,this.user.login,this.meta.branch||'main');
      if(this.head&&state.head!==this.head){const files=await readFiles(this.api,state);this.files=files;this.head=state.head;await this.mergeRemote(roomsFrom(files));}
      const rooms=structuredClone(this.getLibrary().projects),next=filesFor(rooms);
      const changes=[...next].filter(([path,value])=>this.files.get(path)!==value);
      if(changes.length){
        const entries=[];
        for(const [path,content] of changes){
          if(new TextEncoder().encode(content).length>90_000_000)throw Error(`The synced file ${path} is too large for GitHub. Export a local backup instead.`);
          const blob=await this.api('POST',`${state.base}/git/blobs`,{content,encoding:'utf-8'});
          entries.push({path,mode:'100644',type:'blob',sha:blob.sha});
        }
        const tree=await this.api('POST',`${state.base}/git/trees`,{base_tree:state.tree,tree:entries});
        const commit=await this.api('POST',`${state.base}/git/commits`,{message:'Sync Concentavo rehearsal rooms',tree:tree.sha,parents:[state.head]});
        try{await this.api('PATCH',`${state.base}/git/refs/heads/${encodeURIComponent(this.meta.branch||'main')}`,{sha:commit.sha,force:false});}
        catch(error){if(error.status===422){this.head=state.head;this.status('pending','Another device updated GitHub. Sync again to reconcile changes.');this.schedule();return;}throw error;}
        this.head=commit.sha;this.files=next;
      }else{this.head=state.head;this.files=next;}
      const baseline={};for(const room of rooms)baseline[room.id]=await fingerprint(room);
      this.meta.baseline=baseline;this.meta.updated=new Date().toISOString();this.remember();this.status('current');
    }catch(error){this.status('error',error.message);throw error;}
  }
}

export const roomSyncInternals={filesFor,roomsFrom,fingerprint};
