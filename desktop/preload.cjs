const { contextBridge, ipcRenderer } = require('electron');
const invoke=async(name,...args)=>{const response=await ipcRenderer.invoke(name,...args);if(!response.ok)throw Error(response.error);return response.value;};
contextBridge.exposeInMainWorld('choirloomDesktop',{
  saveFile:(name,data)=>ipcRenderer.invoke('save-file',name,data),
  githubStatus:()=>invoke('github-status'),githubLogin:()=>invoke('github-login'),githubCancelLogin:()=>invoke('github-cancel-login'),
  githubPublish:data=>invoke('github-publish',data),githubSiteStatus:id=>invoke('github-site-status',id),githubOpen:id=>invoke('github-open',id),
  checkUpdates:()=>ipcRenderer.invoke('check-updates'),
  onUpdateStatus:callback=>{const listener=(_event,data)=>callback(data);ipcRenderer.on('update-status',listener);return ()=>ipcRenderer.removeListener('update-status',listener);},
  onGithubProgress:callback=>{const listener=(_event,data)=>callback(data);ipcRenderer.on('github-progress',listener);return ()=>ipcRenderer.removeListener('github-progress',listener);}
});
