const {app,shell,safeStorage}=require('electron');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const fs=require('node:fs/promises');
const path=require('node:path');
const {publishProject}=require('./github-core.cjs');
const run=promisify(execFile);
let signIn=null,publishing=false;
function helper(){return app.isPackaged?path.join(process.resourcesPath,'github',process.platform==='win32'?'gh.exe':'gh'):path.join(__dirname,'..','vendor','gh',`${process.platform==='darwin'?'mac':'win'}-${process.arch}`,process.platform==='win32'?'gh.exe':'gh');}
function env(){const e={...process.env,GH_CONFIG_DIR:path.join(app.getPath('userData'),'github-auth'),GH_PROMPT_DISABLED:'1',GH_HOST:'github.com',GH_PAGER:'cat'};for(const k of ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN'])delete e[k];return e;}
const tokenPath=()=>path.join(app.getPath('userData'),'github-token.enc');
async function token(){try{return safeStorage.decryptString(await fs.readFile(tokenPath()));}catch{throw Error('Sign in to GitHub to publish your website.');}}
async function api(method,endpoint,data){
  const key=await token(),response=await fetch(`https://api.github.com${endpoint}`,{method,headers:{Authorization:`Bearer ${key}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'Concentavo'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(120000)});
  const body=await response.text();let result;try{result=body?JSON.parse(body):null;}catch{result=null;}
  if(!response.ok){const e=Error(response.status===401?'Your GitHub sign-in expired. Sign in again.':response.status===403?'GitHub did not allow this action. Check your account permissions or try again later.':result?.message||`GitHub request failed (${response.status}).`);e.status=response.status;throw e;}return result;
}
async function status(){try{const user=await api('GET','/user');return {connected:true,login:user.login,name:user.name};}catch(e){return {connected:false,message:e.message};}}
async function login(send){
  if(signIn)throw Error('A sign-in is already open. Complete it in your browser.');if(!safeStorage.isEncryptionAvailable())throw Error('Your operating system’s secure credential storage is unavailable. Please unlock your account and try again.');await fs.mkdir(env().GH_CONFIG_DIR,{recursive:true,mode:0o700});
  return new Promise((resolve,reject)=>{
    const child=spawn(helper(),['auth','login','--web','--hostname','github.com','--git-protocol','https'],{env:{...env(),GH_BROWSER:process.platform==='win32'?'cmd /c rem':'true'},windowsHide:true,stdio:['pipe','pipe','pipe']});signIn=child;let output='',opened=false;
    const timeout=setTimeout(()=>{child.kill();},10*60*1000);
    const read=buffer=>{output=(output+buffer.toString()).slice(-10000);const code=output.match(/one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i)?.[1];if(code&&!opened){opened=true;send({type:'auth',code,message:'Enter this one-time code in the GitHub page.'});shell.openExternal('https://github.com/login/device');child.stdin.write('\n');}};
    child.stdout.on('data',read);child.stderr.on('data',read);child.on('error',e=>{clearTimeout(timeout);signIn=null;reject(Error('The GitHub sign-in helper could not start. Reinstall Concentavo and try again.'));});
    child.stdin.on('error',()=>{});
    child.on('close',async code=>{clearTimeout(timeout);signIn=null;try{if(code!==0)throw Error('GitHub sign-in was cancelled or could not finish. Try again.');const secret=(await run(helper(),['auth','token','--hostname','github.com'],{env:env(),timeout:15000,windowsHide:true})).stdout.trim();await fs.writeFile(tokenPath(),safeStorage.encryptString(secret),{mode:0o600});const user=await status();if(user.connected)resolve(user);else throw Error(user.message);}catch(e){reject(Error(e.message==='Sign in to GitHub to publish your website.'?e.message:'GitHub sign-in could not finish. Please try again.'));}finally{await fs.rm(env().GH_CONFIG_DIR,{recursive:true,force:true}).catch(()=>{});}});
  });
}
const journalPath=()=>path.join(app.getPath('userData'),'published-sites.json');
async function journal(){try{return JSON.parse(await fs.readFile(journalPath(),'utf8'));}catch{return {};}}
async function remember(id,target){const records=await journal();records[id]=target;await fs.mkdir(app.getPath('userData'),{recursive:true});const file=journalPath();await fs.writeFile(file+'.tmp',JSON.stringify(records));await fs.rename(file+'.tmp',file);}
function register(ipcMain,getWindow){
  const safe=(name,fn)=>ipcMain.handle(name,async(event,...args)=>{if(event.sender!==getWindow()?.webContents)throw Error('Unknown window.');try{return {ok:true,value:await fn(...args)};}catch(e){return {ok:false,error:e.message||'Something went wrong. Please try again.'};}});
  const send=data=>getWindow()?.webContents.send('github-progress',data);
  safe('github-status',status);safe('github-login',()=>login(send));safe('github-cancel-login',()=>{signIn?.kill();return true;});
  safe('github-publish',async input=>{if(publishing)throw Error('A website is already being published.');if(!input||typeof input.projectId!=='string')throw Error('Invalid project.');publishing=true;try{const saved=(await journal())[input.projectId];return await publishProject({api,projectId:input.projectId,name:input.name,html:input.html,target:saved,onProgress:send,remember:target=>remember(input.projectId,target)});}finally{publishing=false;}});
  safe('github-site-status',async id=>{const target=(await journal())[id];if(!target)return null;let build;try{build=await api('GET',`/repos/${target.owner}/${target.repo}/pages/builds/latest`);}catch(e){if(e.status!==404)throw e;}return {...target,status:build?.commit&&build.commit!==target.commit?'building':build?.status||'building',error:build?.error?.message};});
  safe('github-open',async id=>{const target=(await journal())[id];if(!target?.url||!/^https:\/\/[a-zA-Z0-9-]+\.github\.io\//.test(target.url))throw Error('No published website link is available yet.');await shell.openExternal(target.url);return true;});
}
module.exports={register};
