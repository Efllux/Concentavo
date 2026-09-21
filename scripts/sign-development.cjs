const {execFileSync}=require('node:child_process');
const {readdir,rm}=require('node:fs/promises');
const path=require('node:path');
const languages=new Set(require('../package.json').build.electronLanguages);
module.exports=async context=>{
  if(context.electronPlatformName!=='darwin')return;
  const app=path.join(context.appOutDir,'Concentavo.app');
  // electron-builder 26 looks for macOS locales in the old location. Electron
  // 44 stores them in its framework, so remove unused resources here instead.
  const resources=path.join(app,'Contents/Frameworks/Electron Framework.framework/Versions/A/Resources');
  for(const entry of await readdir(resources)){
    if(!entry.endsWith('.lproj'))continue;
    const locale=entry.slice(0,-6).replace('_','-');
    const base=locale.split('-')[0];
    if(!languages.has(locale)&&!languages.has(base))await rm(path.join(resources,entry),{recursive:true,force:true});
  }
  // Re-sign after pruning so nested Electron signatures do not refer to removed
  // locale files. Local integrity signatures also let Apple Silicon run.
  // They are not publisher certificates and do not satisfy Gatekeeper notarization.
  execFileSync('codesign',['--force','--sign','-',path.join(app,'Contents/Resources/github/gh')],{stdio:'inherit'});
  execFileSync('codesign',['--force','--deep','--sign','-',app],{stdio:'inherit'});
};
