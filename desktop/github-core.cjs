const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function validateTarget(owner,repo){if(!/^[a-zA-Z0-9-]{1,39}$/.test(owner)||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(repo))throw Error('Choose a website name using letters, numbers and hyphens.');}
const decode=entry=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(entry.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));
async function contentOrNull(api,path){try{return await api('GET',path);}catch(error){if(error.status===404)return null;throw error;}}
async function ensurePages(api,base,branch,owner,repo){
  let pages;try{pages=await api('GET',`${base}/pages`);}
  catch(error){if(error.status!==404)throw error;pages=await api('POST',`${base}/pages`,{build_type:'legacy',source:{branch,path:'/'}});}
  if(pages.source?.branch!==branch||pages.source?.path!=='/'||pages.build_type==='workflow')pages=await api('PUT',`${base}/pages`,{build_type:'legacy',source:{branch,path:'/'}})||pages;
  try{await api('POST',`${base}/pages/builds`);}catch(error){if(![409,422].includes(error.status))throw error;}
  return pages.html_url||`https://${owner}.github.io/${repo}/`;
}
async function publishSharedRoom({api,projectId,name,html,target,onProgress,remember}){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(projectId))throw Error('This room has an invalid identifier.');
  const user=await api('GET','/user'),owner=user.login,repoName=target?.repo||name;
  validateTarget(owner,repoName);
  if(target&&target.layout!=='shared')throw Error('This room already has its own repository. Its website link has been kept.');
  if(target&&target.projectId!==projectId)throw Error('This website belongs to a different rehearsal room.');
  if(target&&target.owner.toLowerCase()!==owner.toLowerCase())throw Error('Sign in to the GitHub account that owns this website.');
  let repo=await contentOrNull(api,`/repos/${owner}/${repoName}`),createdNow=false;
  if(!repo){onProgress({message:'Creating the shared choir website…'});repo=await api('POST','/user/repos',{name:repoName,description:'Concentavo rehearsal rooms',private:false,auto_init:true});createdNow=true;}
  if(repo.private)throw Error('The shared practice website must be a public repository.');
  const base=`/repos/${owner}/${repo.name}`,branch=target?.branch||repo.default_branch||'main';
  const rootMarker=await contentOrNull(api,`${base}/contents/.concentavo-rooms.json?ref=${encodeURIComponent(branch)}`);
  if(!rootMarker&&!createdNow)throw Error('This repository is not a Concentavo shared website. Choose a new name.');
  if(rootMarker&&decode(rootMarker).format!=='concentavo-rooms')throw Error('This repository belongs to another website.');
  const folder=`rooms/${projectId}`;
  const roomMarker=await contentOrNull(api,`${base}/contents/${folder}/.concentavo-site.json?ref=${encodeURIComponent(branch)}`);
  if(roomMarker&&decode(roomMarker).projectId!==projectId)throw Error('This room path belongs to another website.');
  if(target&&!roomMarker)throw Error('The existing room marker is missing; publishing was stopped to protect the website.');
  const currentPage=await contentOrNull(api,`${base}/contents/${folder}/index.html?ref=${encodeURIComponent(branch)}`);
  if(currentPage&&!roomMarker)throw Error('This room path already contains another website.');
  if(target?.roomSha&&currentPage?.sha!==target.roomSha)throw Error('This room was updated from another device. Restore the latest room backup before publishing again.');
  onProgress({message:'Uploading this room…'});
  let ref;for(let attempt=0;attempt<5;attempt++){try{ref=await api('GET',`${base}/git/ref/heads/${encodeURIComponent(branch)}`);break;}catch(error){if(attempt===4||error.status!==404)throw error;await sleep(1000);}}
  const head=await api('GET',`${base}/git/commits/${ref.object.sha}`);
  const files=[{path:`${folder}/index.html`,content:html},{path:`${folder}/.concentavo-site.json`,content:JSON.stringify({version:1,projectId})}];
  if(createdNow)files.push({path:'.concentavo-rooms.json',content:JSON.stringify({format:'concentavo-rooms',version:1})},{path:'index.html',content:'<!DOCTYPE html><html lang="en"><meta charset="utf-8"><title>Concentavo rooms</title><body><h1>Concentavo rooms</h1><p>Open a room using its shared link.</p></body></html>'},{path:'.nojekyll',content:''});
  const tree=await api('POST',`${base}/git/trees`,{base_tree:head.tree.sha,tree:files.map(file=>({...file,mode:'100644',type:'blob'}))});
  const commit=await api('POST',`${base}/git/commits`,{message:'Update Concentavo rehearsal room',tree:tree.sha,parents:[ref.object.sha]});
  try{await api('PATCH',`${base}/git/refs/heads/${encodeURIComponent(branch)}`,{sha:commit.sha,force:false});}
  catch(error){if(error.status===422)throw Error('Another room changed this website during upload. Try Publish again.');throw error;}
  onProgress({message:'Asking GitHub to put your website online…'});
  const rootUrl=await ensurePages(api,base,branch,owner,repo.name);
  const updatedPage=await api('GET',`${base}/contents/${folder}/index.html?ref=${encodeURIComponent(branch)}`);
  const result={owner,repo:repo.name,branch,projectId,layout:'shared',path:folder,roomSha:updatedPage.sha,url:new URL(`${folder}/`,rootUrl.endsWith('/')?rootUrl:rootUrl+'/').href,commit:commit.sha,updated:new Date().toISOString()};
  await remember(result);onProgress({message:'Uploaded. GitHub is preparing the website.'});return result;
}
async function publishProject({api,projectId,name,html,target,layout='separate',onProgress=()=>{},remember=async()=>{}}){
  if(typeof projectId!=='string'||!projectId||typeof html!=='string'||!html.startsWith('<!DOCTYPE html>')||new TextEncoder().encode(html).length>45_000_000)throw Error('This website is too large to publish directly. Export the website ZIP instead.');
  if(target?.layout==='shared'||layout==='shared')return publishSharedRoom({api,projectId,name,html,target,onProgress,remember});
  const user=await api('GET','/user');let repo,createdNow=false;
  if(target){validateTarget(target.owner,target.repo);repo=await api('GET',`/repos/${target.owner}/${target.repo}`);if(repo.private)throw Error('This room points to a private repository. Concentavo publishes public practice websites.');}
  else{
    validateTarget(user.login,name);onProgress({message:'Creating your choir website…'});
    try{repo=await api('POST','/user/repos',{name,description:'A Concentavo choir rehearsal room',private:false,auto_init:true});}
    catch(e){if(e.status===422)throw Error('That website name is already taken in your account. Choose another name.');throw e;}
    target={owner:user.login,repo:repo.name,branch:repo.default_branch||'main',projectId,createdByChoirloom:true};createdNow=true;await remember(target);
  }
  const base=`/repos/${target.owner}/${target.repo}`,branch=target.branch||repo.default_branch;
  if(target.projectId!==projectId)throw Error('This website belongs to a different rehearsal room.');
  // Never update arbitrary repository files. Existing sites must bear this project marker.
  let marker;
  for(const markerName of ['.concentavo-site.json','.choirloom-site.json']){try{const entry=await api('GET',`${base}/contents/${markerName}?ref=${encodeURIComponent(branch)}`);marker=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(entry.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));break;}catch(e){if(e.status!==404)throw e;}}
  if(marker&&marker.projectId!==projectId)throw Error('This repository belongs to another Concentavo rehearsal room.');
  if(!marker&&!createdNow)throw Error('This repository has no Concentavo ownership marker. It cannot be updated safely.');
  onProgress({message:'Uploading scores and practice controls…'});
  let ref;
  for(let attempt=0;attempt<5;attempt++){try{ref=await api('GET',`${base}/git/ref/heads/${encodeURIComponent(branch)}`);break;}catch(e){if(attempt===4||e.status!==404)throw e;await sleep(1000);}}
  const head=await api('GET',`${base}/git/commits/${ref.object.sha}`);
  if(target.commit&&target.commit!==ref.object.sha)throw Error('This website was updated from another device. Restore the latest room backup before publishing again.');
  const files=[{path:'index.html',content:html},{path:'.nojekyll',content:''},{path:'.concentavo-site.json',content:JSON.stringify({version:1,projectId})}];
  const tree=await api('POST',`${base}/git/trees`,{base_tree:head.tree.sha,tree:files.map(f=>({...f,mode:'100644',type:'blob'}))});
  const commit=await api('POST',`${base}/git/commits`,{message:'Update Concentavo rehearsal room',tree:tree.sha,parents:[ref.object.sha]});
  try{await api('PATCH',`${base}/git/refs/heads/${encodeURIComponent(branch)}`,{sha:commit.sha,force:false});}
  catch(e){if(e.status===422)throw Error('The website changed during upload. Click Update website to try again.');throw e;}
  onProgress({message:'Asking GitHub to put your website online…'});
  const url=await ensurePages(api,base,branch,target.owner,target.repo);
  const result={...target,layout:'separate',branch,url,commit:commit.sha,updated:new Date().toISOString()};await remember(result);
  onProgress({message:'Uploaded. GitHub is preparing the website.'});return result;
}
module.exports={publishProject,validateTarget};
