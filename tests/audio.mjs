import {build} from 'esbuild';
import assert from 'node:assert/strict';

const result=await build({entryPoints:['src/audio.js'],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'sample-stubs',setup(plugin){plugin.onLoad({filter:/\.mp3$/},()=>({contents:'export default "sample"',loader:'js'}));}}]});
const module={exports:{}};
new Function('module','exports',result.outputFiles[0].text)(module,module.exports);
const {PracticeAudio}=module.exports;
const events=[];
const param=()=>({value:0,setValueAtTime(value,time){events.push(['set',value,time]);},exponentialRampToValueAtTime(value,time){events.push(['ramp',value,time]);}});
const node=()=>({connect(target){return target;},disconnect(){},start(){},stop(){},gain:param(),pan:param(),frequency:param(),Q:param(),playbackRate:param()});
const context={destination:node(),createGain:node,createStereoPanner:node,createBufferSource:node,createBiquadFilter:node};
const audio=new PracticeAudio(()=>{},()=>{});
audio.samples=[{midi:60,buffer:{}}];
audio.note(context,{midi:60,velocity:1,lane:'soprano'},1,3,{soprano:{volume:1,sound:'piano'}},0,true);
const held=events.find(([type,value,time])=>type==='set'&&time===4&&value>.1);
const release=events.find(([type,value,time])=>type==='ramp'&&time>4&&value<.001);
assert.ok(held,'Recorded piano stays audible through the written note duration');
assert.ok(release,'Recorded piano releases after the note ends');
console.log('PASS: recorded piano sustains through the written note and releases afterward.');
