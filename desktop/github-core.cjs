const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function validateTarget(owner,repo){if(!/^[a-zA-Z0-9-]{1,39}$/.test(owner)||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(repo))throw Error('Choose a website name using letters, numbers and hyphens.');}
async function publishProject({api,projectId,name,html,target,onProgress=()=>{},remember=async()=>{}}){
  if(typeof projectId!=='string'||!projectId||typeof html!=='string'||!html.startsWith('<!DOCTYPE html>')||Buffer.byteLength(html)>45_000_000)throw Error('This website is too large to publish directly. Export the website ZIP instead.');
  const user=await api('GET','/user');let repo;
  if(target){validateTarget(target.owner,target.repo);repo=await api('GET',`/repos/${target.owner}/${target.repo}`);if(repo.private)throw Error('This room points to a private repository. Concentavo publishes public practice websites.');}
  else{
    validateTarget(user.login,name);onProgress({message:'Creating your choir website…'});
    try{repo=await api('POST','/user/repos',{name,description:'A Concentavo choir rehearsal room',private:false,auto_init:true});}
    catch(e){if(e.status===422)throw Error('That website name is already taken in your account. Choose another name.');throw e;}
    target={owner:user.login,repo:repo.name,branch:repo.default_branch||'main',projectId,createdByChoirloom:true};await remember(target);
  }
  const base=`/repos/${target.owner}/${target.repo}`,branch=target.branch||repo.default_branch;
  if(target.projectId!==projectId)throw Error('This website belongs to a different rehearsal room.');
  // Never update arbitrary repository files. Existing sites must bear this project marker.
  let marker;
  for(const markerName of ['.concentavo-site.json','.choirloom-site.json']){try{const entry=await api('GET',`${base}/contents/${markerName}?ref=${encodeURIComponent(branch)}`);marker=JSON.parse(Buffer.from(entry.content,'base64').toString());break;}catch(e){if(e.status!==404)throw e;}}
  if(marker&&marker.projectId!==projectId)throw Error('This repository belongs to another Concentavo rehearsal room.');
  if(!marker&&!target.createdByChoirloom)throw Error('This repository was not created by Concentavo.');
  onProgress({message:'Uploading scores and practice controls…'});
  let ref;
  for(let attempt=0;attempt<5;attempt++){try{ref=await api('GET',`${base}/git/ref/heads/${encodeURIComponent(branch)}`);break;}catch(e){if(attempt===4||e.status!==404)throw e;await sleep(1000);}}
  const head=await api('GET',`${base}/git/commits/${ref.object.sha}`);
  const files=[{path:'index.html',content:html},{path:'.nojekyll',content:''},{path:'.concentavo-site.json',content:JSON.stringify({version:1,projectId})}];
  const tree=await api('POST',`${base}/git/trees`,{base_tree:head.tree.sha,tree:files.map(f=>({...f,mode:'100644',type:'blob'}))});
  const commit=await api('POST',`${base}/git/commits`,{message:'Update Concentavo rehearsal room',tree:tree.sha,parents:[ref.object.sha]});
  try{await api('PATCH',`${base}/git/refs/heads/${encodeURIComponent(branch)}`,{sha:commit.sha,force:false});}
  catch(e){if(e.status===422)throw Error('The website changed during upload. Click Update website to try again.');throw e;}
  onProgress({message:'Asking GitHub to put your website online…'});
  let pages;try{pages=await api('GET',`${base}/pages`);}
  catch(e){if(e.status!==404)throw e;pages=await api('POST',`${base}/pages`,{build_type:'legacy',source:{branch,path:'/'}});}
  if(pages.source?.branch!==branch||pages.source?.path!=='/'||pages.build_type==='workflow')pages=await api('PUT',`${base}/pages`,{build_type:'legacy',source:{branch,path:'/'}})||pages;
  try{await api('POST',`${base}/pages/builds`);}catch(e){if(![409,422].includes(e.status))throw e;}
  const result={...target,branch,url:pages.html_url||`https://${target.owner}.github.io/${target.repo}/`,commit:commit.sha,updated:new Date().toISOString()};await remember(result);
  onProgress({message:'Uploaded. GitHub is preparing the website.'});return result;
}
module.exports={publishProject,validateTarget};
