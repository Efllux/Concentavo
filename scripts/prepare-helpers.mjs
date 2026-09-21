import {mkdir,writeFile,chmod} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';
const version='2.97.0',base=`https://github.com/cli/cli/releases/download/v${version}/`;
async function get(name){const r=await fetch(base+name);if(!r.ok)throw Error(`Cannot download ${name}: ${r.status}`);return new Uint8Array(await r.arrayBuffer());}
const sums=strFromU8(await get(`gh_${version}_checksums.txt`));
const targets=process.argv.includes('--all')?['mac-arm64','mac-x64','win-x64']:process.platform==='darwin'?['mac-arm64','mac-x64']:['win-x64'];
for(const target of targets){
  const [platform,cpu]=target.split('-');
  const archive=`gh_${version}_${platform==='mac'?'macOS':'windows'}_${cpu==='x64'?'amd64':'arm64'}.zip`;
  console.log(`Preparing GitHub sign-in for ${target}…`);const bytes=await get(archive),hash=createHash('sha256').update(bytes).digest('hex');
  if(!sums.split('\n').some(line=>line.startsWith(hash)&&line.trim().endsWith(archive)))throw Error(`Checksum verification failed: ${archive}`);
  const entries=unzipSync(bytes),exe=Object.keys(entries).find(n=>n.endsWith(platform==='mac'?'/bin/gh':'/bin/gh.exe')||n===(platform==='mac'?'bin/gh':'bin/gh.exe'));
  if(!exe)throw Error('GitHub helper is missing from archive.');
  const dir=`vendor/gh/${target}`;await mkdir(dir,{recursive:true});const dest=`${dir}/${platform==='mac'?'gh':'gh.exe'}`;await writeFile(dest,entries[exe]);if(platform==='mac')await chmod(dest,0o755);
  const license=Object.entries(entries).find(([name])=>/^(LICENSE|COPYING)(\.(txt|md))?$/i.test(name.split('/').pop()));
  if(!license)throw Error(`GitHub helper licence is missing: ${archive}`);
  await writeFile(`${dir}/LICENSE.txt`,license[1]);
  console.log(`Verified ${archive}`);
}
