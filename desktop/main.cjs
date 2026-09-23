const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs/promises');
let main;
let updateStatus={state:'idle',current:app.getVersion()},updateCheck;
function reportUpdate(status){updateStatus={...updateStatus,...status};main?.webContents.send('update-status',updateStatus);}
function checkUpdates(){
  if(!app.isPackaged)return Promise.resolve({state:'development',current:app.getVersion()});
  if(updateCheck)return updateCheck;
  updateCheck=autoUpdater.checkForUpdates().then(()=>updateStatus).catch(error=>{reportUpdate({state:'error',message:error.message});return updateStatus;}).finally(()=>{updateCheck=null;});
  return updateCheck;
}
if(!process.argv.some(arg=>arg.startsWith('--user-data-dir=')))app.setPath('userData',path.join(app.getPath('appData'),'Choirloom'));
app.setName('Concentavo');
function openWindow(){
  main=new BrowserWindow({width:1440,height:960,minWidth:760,minHeight:600,title:'Concentavo',icon:path.join(__dirname,'../build/icon.png'),backgroundColor:'#f6f4f0',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  main.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  main.webContents.on('will-navigate',event=>event.preventDefault());
  main.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  main.loadFile(path.join(__dirname,'../dist/index.html'));
}
app.whenReady().then(()=>{
  require('./github.cjs').register(ipcMain,()=>main);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform==='darwin'?[{label:'Concentavo',submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{type:'separator'},{role:'quit'}]}]:[]),
    {label:'File',submenu:[{label:'Print score',accelerator:'CmdOrCtrl+P',click:()=>main?.webContents.print()},{role:process.platform==='darwin'?'close':'quit'}]},
    {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    {label:'View',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}
  ]));
  ipcMain.handle('save-file',async(event,name,bytes)=>{
    if(event.sender!==main?.webContents||typeof name!=='string'||!ArrayBuffer.isView(bytes)||bytes.byteLength>250_000_000)throw Error('Invalid export.');
    const safe=path.basename(name).replace(/[<>:"/\\|?*\x00-\x1f]/g,'-');
    const {canceled,filePath}=await dialog.showSaveDialog(main,{defaultPath:safe});if(canceled||!filePath)return false;
    await fs.writeFile(filePath,Buffer.from(bytes));return true;
  });
  ipcMain.handle('check-updates',()=>checkUpdates());
  ipcMain.handle('update-status',()=>updateStatus);
  openWindow();
  if(app.isPackaged){
    autoUpdater.autoDownload=true;autoUpdater.autoInstallOnAppQuit=true;
    autoUpdater.allowPrerelease=app.getVersion().includes('-');
    autoUpdater.on('checking-for-update',()=>reportUpdate({state:'checking',message:''}));
    autoUpdater.on('update-available',info=>reportUpdate({state:'downloading',version:info.version}));
    autoUpdater.on('update-not-available',()=>reportUpdate({state:'current',version:app.getVersion()}));
    autoUpdater.on('update-downloaded',info=>reportUpdate({state:'ready',version:info.version}));
    autoUpdater.on('error',error=>reportUpdate({state:'error',message:error.message}));
    setTimeout(checkUpdates,8000);
    setInterval(checkUpdates,6*60*60*1000);
  }
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)openWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
