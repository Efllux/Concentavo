import A0 from './assets/piano/A0.mp3';
import C1 from './assets/piano/C1.mp3';
import Ds1 from './assets/piano/Ds1.mp3';
import Fs1 from './assets/piano/Fs1.mp3';
import A1 from './assets/piano/A1.mp3';
import C2 from './assets/piano/C2.mp3';
import Ds2 from './assets/piano/Ds2.mp3';
import Fs2 from './assets/piano/Fs2.mp3';
import A2 from './assets/piano/A2.mp3';
import C3 from './assets/piano/C3.mp3';
import Ds3 from './assets/piano/Ds3.mp3';
import Fs3 from './assets/piano/Fs3.mp3';
import A3 from './assets/piano/A3.mp3';
import C4 from './assets/piano/C4.mp3';
import Ds4 from './assets/piano/Ds4.mp3';
import Fs4 from './assets/piano/Fs4.mp3';
import A4 from './assets/piano/A4.mp3';
import C5 from './assets/piano/C5.mp3';
import Ds5 from './assets/piano/Ds5.mp3';
import Fs5 from './assets/piano/Fs5.mp3';
import A5 from './assets/piano/A5.mp3';
import C6 from './assets/piano/C6.mp3';
import Ds6 from './assets/piano/Ds6.mp3';
import Fs6 from './assets/piano/Fs6.mp3';
import A6 from './assets/piano/A6.mp3';
import C7 from './assets/piano/C7.mp3';
import Ds7 from './assets/piano/Ds7.mp3';
import Fs7 from './assets/piano/Fs7.mp3';
import A7 from './assets/piano/A7.mp3';
import C8 from './assets/piano/C8.mp3';

// Salamander recordings at every minor third keep pitch-shifting within one semitone.
const pianoSources=[[21,A0],[24,C1],[27,Ds1],[30,Fs1],[33,A1],[36,C2],[39,Ds2],[42,Fs2],[45,A2],[48,C3],[51,Ds3],[54,Fs3],[57,A3],[60,C4],[63,Ds4],[66,Fs4],[69,A4],[72,C5],[75,Ds5],[78,Fs5],[81,A5],[84,C6],[87,Ds6],[90,Fs6],[93,A6],[96,C7],[99,Ds7],[102,Fs7],[105,A7],[108,C8]];
export const sounds={
  piano:{label:'Studio piano · recorded',kind:'sample',tone:11200},
  pianoMellow:{label:'Mellow piano · recorded',kind:'sample',tone:7200,mellow:true},
  pianoBright:{label:'Bright piano · recorded',kind:'sample',tone:15500,bright:true},
  organ:{label:'Organ',harmonics:[1,.15,.45,.12,.2],attack:.02,decay:0,sustain:.85},
  flute:{label:'Flute',harmonics:[1,.12,.04],attack:.035,decay:0,sustain:.8},
  strings:{label:'Strings',harmonics:[1,.5,.3,.2,.13,.08],attack:.08,decay:0,sustain:.75},
  choirAh:{label:'Choir · ah (synth)',vowel:[800,1150,2900],attack:.055,decay:0,sustain:.85},
  choirOo:{label:'Choir · oo (synth)',vowel:[350,750,2400],attack:.055,decay:0,sustain:.85},
  tone:{label:'Soft tone',harmonics:[1,0,.11,0,.04],attack:.015,decay:0,sustain:.72}
};
export class PracticeAudio {
  constructor(onTick,onEnd){this.onTick=onTick;this.onEnd=onEnd;this.speed=1;this.transpose=0;this.mix={};this.position=0;this.playing=false;this.nodes=new Set();}
  async init(){if(!this.context)this.context=new AudioContext();await this.context.resume();if(!this.samplePromise)this.samplePromise=Promise.all(pianoSources.map(async([midi,url])=>{const data=await (await fetch(url)).arrayBuffer();return {midi,buffer:await this.context.decodeAudioData(data)};})).then(samples=>this.samples=samples).catch(()=>this.samples=[]);await this.samplePromise;}
  setTimeline(t){this.stop();this.timeline=t;this.position=0;}
  clock(){return this.playing?Math.min(this.endTime,this.anchorPosition+Math.max(0,this.context.currentTime-this.anchorTime)*this.speed):this.position;}
  async play(countIn=false){
    await this.init();if(this.playing)return;
    if(this.position>=this.timeline.duration-.01)this.position=0;
    this.endTime=this.loop?this.loop.end:this.timeline.duration;
    if(this.loop && (this.position<this.loop.start || this.position>=this.loop.end))this.position=this.loop.start;
    this.anchorPosition=this.position;this.anchorTime=this.context.currentTime+.08;
    if(countIn){const tempo=this.timeline.segments.find(s=>this.position<s.time+s.duration)?.bpm||100;const step=60/tempo/this.speed;for(let i=0;i<4;i++)this.click(this.anchorTime+i*step,i===0);this.anchorTime+=4*step;}
    this.playing=true;this.nextIndex=this.timeline.events.findIndex(n=>n.time+n.seconds>this.position);if(this.nextIndex<0)this.nextIndex=this.timeline.events.length;
    this.tick();this.timer=setInterval(()=>this.tick(),25);
  }
  tick(){
    if(!this.playing)return;const now=this.context.currentTime,position=this.clock();
    while(this.nextIndex<this.timeline.events.length){const n=this.timeline.events[this.nextIndex];if(n.time>=this.endTime || this.anchorTime+(n.time-this.anchorPosition)/this.speed>now+.14)break;this.nextIndex++;const start=Math.max(n.time,this.anchorPosition),end=Math.min(n.time+n.seconds,this.endTime);if(end>start)this.note(this.context,n,this.anchorTime+(start-this.anchorPosition)/this.speed,(end-start)/this.speed,this.mix,this.transpose);}
    this.onTick(position);
    if(position>=this.endTime-.002){if(this.loop){this.pause();this.position=this.loop.start;this.play();}else{this.pause();this.position=this.timeline.duration;this.onTick(this.position);this.onEnd();}}
  }
  note(ctx,n,time,duration,mix,transpose,offline=false){
    const settings=mix[n.lane]||{volume:.75,pan:0},anySolo=Object.values(mix).some(x=>x.solo);
    if(settings.mute || (anySolo&&!settings.solo) || settings.volume===0)return;
    const gain=ctx.createGain(),pan=ctx.createStereoPanner();
    const preset=sounds[settings.sound]||sounds.piano,freq=440*2**((n.midi+transpose-69)/12);
    if(preset.kind==='sample'&&this.samples?.length){const target=n.midi+transpose,sample=this.samples.reduce((best,item)=>Math.abs(item.midi-target)<Math.abs(best.midi-target)?item:best),source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),body=ctx.createBiquadFilter(),peak=(settings.volume??.75)*(n.velocity??.7)*.34,release=Math.min(.9,Math.max(.35,duration*.32));source.buffer=sample.buffer;source.playbackRate.value=2**((target-sample.midi)/12);filter.type='lowpass';filter.frequency.value=preset.tone||11200;filter.Q.value=.25;body.type='peaking';body.frequency.value=preset.mellow?240:310;body.Q.value=.7;body.gain.value=preset.mellow?2.2:.8;pan.pan.value=settings.pan||0;gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),time+.006);gain.gain.setValueAtTime(Math.max(.0002,peak*.88),time+Math.min(.16,duration*.4));gain.gain.exponentialRampToValueAtTime(.0001,time+duration+release);source.connect(filter).connect(body).connect(gain).connect(pan).connect(ctx.destination);source.start(time);source.stop(time+duration+release+.04);if(!offline){this.nodes.add(source);source.onended=()=>{this.nodes.delete(source);source.disconnect();filter.disconnect();body.disconnect();gain.disconnect();pan.disconnect();};}return;}
    const osc=ctx.createOscillator();
    if(preset.kind==='piano'){
      const master=ctx.createGain(),filter=ctx.createBiquadFilter(),partials=preset.harmonics,peak=(settings.volume??.75)*(n.velocity??.7)*.075;
      filter.type='lowpass';filter.frequency.value=preset.bright?6200:4400;filter.Q.value=.55;pan.pan.value=settings.pan||0;master.connect(filter).connect(pan).connect(ctx.destination);
      const keyDecay=Math.max(.72,Math.min(1.45,440/freq));
      partials.forEach((level,index)=>{const harmonic=index+1,detunes=index===0?[-2.7,0,2.1]:[index%2?1.8:-1.2];for(const detune of detunes){const voice=ctx.createOscillator(),envelope=ctx.createGain(),share=index===0?.46:1,life=Math.max(.1,Math.min(duration+.65,(preset.bright?2.05:2.7)*keyDecay/(1+index*.38)));voice.type=index<2?'sine':'triangle';voice.frequency.value=freq*harmonic*(1+index*index*.00016);voice.detune.value=detune;envelope.gain.setValueAtTime(.0001,time);envelope.gain.exponentialRampToValueAtTime(Math.max(.0002,peak*level*share),time+.003+index*.0006);envelope.gain.exponentialRampToValueAtTime(.0001,time+life);voice.connect(envelope).connect(master);voice.start(time);voice.stop(time+life+.025);if(!offline){this.nodes.add(voice);voice.onended=()=>{this.nodes.delete(voice);voice.disconnect();envelope.disconnect();};}}}
      );
      const hammer=ctx.createOscillator(),hammerGain=ctx.createGain();hammer.type='triangle';hammer.frequency.value=freq*2.03;hammerGain.gain.setValueAtTime(peak*.42,time);hammerGain.gain.exponentialRampToValueAtTime(.0001,time+.025);hammer.connect(hammerGain).connect(filter);hammer.start(time);hammer.stop(time+.03);if(!offline){this.nodes.add(hammer);hammer.onended=()=>{this.nodes.delete(hammer);hammer.disconnect();hammerGain.disconnect();};}return;
    }
    const harmonics=preset.vowel?Array.from({length:32},(_,i)=>{const f=(i+1)*freq;return .12/(i+1)+preset.vowel.reduce((sum,formant,j)=>sum+Math.exp(-.5*((f-formant)/(j===2?280:130))**2)/(1+j*.3),0)/(i+1)**.4;}):preset.harmonics;
    osc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(harmonics.length+1),new Float32Array([0,...harmonics])));osc.frequency.value=freq;pan.pan.value=settings.pan||0;
    const peak=(settings.volume??.75)*(n.velocity??.7)*.11,attack=Math.min(preset.attack,duration/3),tail=Math.max(.0001,peak*(preset.decay?Math.max(preset.sustain,Math.exp(-duration*preset.decay)):preset.sustain));
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(peak,time+attack);gain.gain.exponentialRampToValueAtTime(tail,time+Math.max(attack+.001,duration*.85));gain.gain.linearRampToValueAtTime(0,time+duration+.05);
    osc.connect(gain).connect(pan).connect(ctx.destination);osc.start(time);osc.stop(time+duration+.06);
    if(!offline){this.nodes.add(osc);osc.onended=()=>{this.nodes.delete(osc);osc.disconnect();gain.disconnect();pan.disconnect();};}
  }
  click(time,strong){const o=this.context.createOscillator(),g=this.context.createGain();o.frequency.value=strong?1100:800;g.gain.setValueAtTime(.12,time);g.gain.exponentialRampToValueAtTime(.001,time+.06);o.connect(g).connect(this.context.destination);o.start(time);o.stop(time+.07);this.nodes.add(o);o.onended=()=>{this.nodes.delete(o);o.disconnect();g.disconnect();};}
  pause(){if(this.playing)this.position=this.clock();this.playing=false;clearInterval(this.timer);for(const node of this.nodes){try{node.stop();}catch{}}this.nodes.clear();}
  stop(){this.pause();this.position=0;}
  seek(time){const was=this.playing;this.pause();this.position=Math.max(0,Math.min(this.timeline.duration,time));this.onTick(this.position);if(was)this.play();}
  update(settings){const was=this.playing;this.pause();Object.assign(this,settings);if(was)this.play();}
  async wav(){
    await this.init();
    const start=this.loop?.start||0,end=this.loop?.end||this.timeline.duration,duration=(end-start)/this.speed;
    if(duration>600)throw Error('WAV export is limited to 10 minutes. Select a shorter passage.');
    const ctx=new OfflineAudioContext(2,Math.ceil((duration+.1)*44100),44100);
    for(const n of this.timeline.events){const s=Math.max(start,n.time),e=Math.min(end,n.time+n.seconds);if(e>s)this.note(ctx,n,(s-start)/this.speed,(e-s)/this.speed,this.mix,this.transpose,true);}
    const buffer=await ctx.startRendering(),data=new ArrayBuffer(44+buffer.length*4),view=new DataView(data),text=(p,s)=>{for(let i=0;i<s.length;i++)view.setUint8(p+i,s.charCodeAt(i));};
    text(0,'RIFF');view.setUint32(4,data.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,44100,true);view.setUint32(28,176400,true);view.setUint16(32,4,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,buffer.length*4,true);
    const l=buffer.getChannelData(0),r=buffer.getChannelData(1);for(let i=0;i<buffer.length;i++){view.setInt16(44+i*4,Math.max(-1,Math.min(1,l[i]))*32767,true);view.setInt16(46+i*4,Math.max(-1,Math.min(1,r[i]))*32767,true);}return data;
  }
}
