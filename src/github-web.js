import core from '../desktop/github-core.cjs';

const {publishProject}=core;
const config=JSON.parse(document.querySelector('#web-config')?.textContent||'{}');
const authKey='concentavo-github-auth';
let credential=null;
const random=()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
const callback=()=>new URL('./',location.href).href;

export function configured(){return !!(config.clientId&&config.authUrl);}
export function installationUrl(){return /^[a-z0-9-]+$/.test(config.appSlug||'')?`https://github.com/apps/${config.appSlug}/installations/new`:null;}
export function connected(){return credential&&Date.now()<credential.expiresAt-60_000;}
export function signOut(){credential=null;}
export async function signIn(action='publish'){
  if(!configured())throw Error('GitHub sign-in is not configured on this web app yet. You can export the website ZIP.');
  const verifier=random(),state=random();
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
  const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  sessionStorage.setItem(authKey,JSON.stringify({state,verifier,action,created:Date.now()}));
  const url=new URL('https://github.com/login/oauth/authorize');
  for(const [key,value] of Object.entries({client_id:config.clientId,redirect_uri:callback(),state,code_challenge:challenge,code_challenge_method:'S256'}))url.searchParams.set(key,value);
  location.assign(url.href);
}
export async function finishSignIn(){
  const url=new URL(location.href),code=url.searchParams.get('code'),error=url.searchParams.get('error'),receivedState=url.searchParams.get('state');
  if(!code&&!error)return null;
  const pending=JSON.parse(sessionStorage.getItem(authKey)||'null');sessionStorage.removeItem(authKey);
  url.searchParams.delete('code');url.searchParams.delete('state');url.searchParams.delete('error');url.searchParams.delete('error_description');
  history.replaceState(null,'',url.pathname+url.search+url.hash);
  if(error)throw Error('GitHub sign-in was cancelled.');
  if(!pending||pending.state!==receivedState||Date.now()-pending.created>600_000)throw Error('GitHub sign-in could not be verified. Try again.');
  const response=await fetch(`${config.authUrl.replace(/\/$/,'')}/oauth/exchange`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,codeVerifier:pending.verifier})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.token)throw Error(data.message||'GitHub sign-in failed. Try again.');
  credential={token:data.token,expiresAt:Date.now()+Math.min(Number(data.expiresIn)||28800,28800)*1000};
  return pending.action;
}
export async function api(method,endpoint,data){
  if(!connected())throw Error('Your GitHub session has expired. Sign in again.');
  const response=await fetch(`https://api.github.com${endpoint}`,{method,headers:{Authorization:`Bearer ${credential.token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(120000)});
  const raw=await response.text();let result;try{result=raw?JSON.parse(raw):null;}catch{result=null;}
  if(!response.ok){if(response.status===401)credential=null;const error=Error(response.status===401?'Your GitHub session has expired. Sign in again.':response.status===403?'GitHub denied this action. Check that the Concentavo GitHub App is installed for your account.':result?.message||`GitHub request failed (${response.status}).`);error.status=response.status;throw error;}
  return result;
}
export async function user(){return connected()?api('GET','/user'):null;}
export async function siteStatus(target){
  if(!target?.owner||!target.repo)return null;
  let build;try{build=await api('GET',`/repos/${target.owner}/${target.repo}/pages/builds/latest`);}catch(error){if(error.status!==404)throw error;}
  return {...target,status:target.layout==='shared'?build?.status||'building':build?.commit&&target.commit&&build.commit!==target.commit?'building':build?.status||'building',error:build?.error?.message};
}
export async function publish({projectId,name,html,target,layout,onProgress,remember}){
  return publishProject({api,projectId,name,html,target,layout,onProgress,remember});
}
export async function reconnect(project){
  const published=project.published;if(!published?.url)return null;
  const url=new URL(published.url);
  const match=/^([A-Za-z0-9-]+)\.github\.io$/.exec(url.hostname);
  const repo=url.pathname.split('/').filter(Boolean)[0];
  if(!match||!repo)throw Error('The saved website link is not a GitHub Pages project site.');
  const owner=match[1],base=`/repos/${owner}/${repo}`;
  const repository=await api('GET',base);
  if(repository.private)throw Error('The linked practice website is now private.');
  const parts=url.pathname.split('/').filter(Boolean),shared=parts[1]==='rooms',folder=shared?`rooms/${parts[2]}`:'';
  if(shared&&(!parts[2]||parts.length!==3||parts[2]!==project.id))throw Error('The shared website link does not match this room.');
  let marker;try{marker=await api('GET',`${base}/contents/${folder?`${folder}/`:''}.concentavo-site.json`);}catch(error){if(error.status!==404||shared)throw error;marker=await api('GET',`${base}/contents/.choirloom-site.json`);}
  const parsed=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(marker.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));
  if(parsed.projectId!==project.id)throw Error('This website belongs to a different rehearsal room.');
  if(shared){const root=await api('GET',`${base}/contents/.concentavo-rooms.json`);const data=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(root.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));if(data.format!=='concentavo-rooms')throw Error('The shared website marker is invalid.');}
  const branch=repository.default_branch||'main';
  const ref=await api('GET',`${base}/git/ref/heads/${encodeURIComponent(branch)}`);
  const page=shared?await api('GET',`${base}/contents/${folder}/index.html?ref=${encodeURIComponent(branch)}`):null;
  return {owner,repo,branch,projectId:project.id,layout:shared?'shared':'separate',path:folder||undefined,roomSha:page?.sha,commit:ref.object.sha,url:published.url};
}
