const {execFileSync}=require('node:child_process');
const path=require('node:path');
module.exports=async context=>{
  if(context.electronPlatformName!=='darwin'||context.arch!==4)return;
  const app=path.join(context.appOutDir,'Concentavo.app');
  // Local integrity signatures let universal Apple Silicon binaries run.
  // They are not publisher certificates and do not satisfy Gatekeeper notarization.
  execFileSync('codesign',['--force','--sign','-',path.join(app,'Contents/Resources/github/gh')],{stdio:'inherit'});
  execFileSync('codesign',['--force','--deep','--sign','-',app],{stdio:'inherit'});
};
