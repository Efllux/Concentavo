import { unzipSync } from 'fflate';
import { Midi } from '@tonejs/midi';
import { arrangedScore } from './part-passages.js';
import { inferredVoiceCount, separateVoiceNotes } from './voice-separation.js';
import { playbackRoute, navigationWarnings, notationNavigation, resolveNavigation } from './score-navigation.js';
import { normalizeDocument } from './musicxml-normalize.js';

const children = (n, tag) => Array.from(n?.children||[]).filter(x => x.localName === tag);
const child = (n, tag) => children(n, tag)[0];
const value = (n, tag, fallback = '') => child(n, tag)?.textContent?.trim() || fallback;
const num = (n, tag, fallback = 0) => Number(value(n, tag, String(fallback)));
const all = (n, tag) => Array.from(n.getElementsByTagNameNS('*', tag));
export const escapeXML = s => String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export const uid = () => crypto.randomUUID();
const chordIntervals=kind=>({major:[0,4,7],minor:[0,3,7],diminished:[0,3,6],augmented:[0,4,8],dominant:[0,4,7,10],'major-seventh':[0,4,7,11],'minor-seventh':[0,3,7,10],'diminished-seventh':[0,3,6,9],'augmented-seventh':[0,4,8,10],'half-diminished':[0,3,6,10],'major-minor':[0,3,7,11],'major-sixth':[0,4,7,9],'minor-sixth':[0,3,7,9],'dominant-ninth':[0,4,7,10,14],'major-ninth':[0,4,7,11,14],'minor-ninth':[0,3,7,10,14],'dominant-11th':[0,4,7,10,14,17],'major-11th':[0,4,7,11,14,17],'minor-11th':[0,3,7,10,14,17],'dominant-13th':[0,4,7,10,14,17,21],'major-13th':[0,4,7,11,14,17,21],'minor-13th':[0,3,7,10,14,17,21],'suspended-second':[0,2,7],'suspended-fourth':[0,5,7],suspended_second:[0,2,7],suspended_fourth:[0,5,7],power:[0,7],other:[0]}[kind]);
function harmonyNotes(el){
  const root=child(el,'root');if(!root||value(el,'kind')==='none')return [];
  const step={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[value(root,'root-step')];if(step===undefined)return [];
  const pc=(step+num(root,'root-alter')+12)%12,kind=value(el,'kind','major'),intervals=chordIntervals(kind);if(!intervals)return [];
  for(const degree of children(el,'degree')){
    const n=num(degree,'degree-value'),alter=num(degree,'degree-alter'),type=value(degree,'degree-type');
    if(!Number.isInteger(n)||n<1)continue;
    const simple=(n-1)%7+1,octave=Math.floor((n-1)/7)*12;
    let base=[0,2,4,5,7,9,10][simple-1]+octave;
    // Added degrees use dominant intervals. Altered/subtracted degrees are
    // relative to the interval supplied by the chord kind (MusicXML rule).
    if(type!=='add'){
      if(simple===3&&(kind.startsWith('minor')||kind.includes('diminished')||kind==='major-minor'))base=3+octave;
      if(simple===5&&kind.includes('diminished'))base=6+octave;
      if(simple===5&&kind.startsWith('augmented'))base=8+octave;
      if(simple===7&&(kind.startsWith('major-')||kind==='major-minor'))base=11+octave;
      if(simple===7&&kind==='diminished-seventh')base=9+octave;
    }
    if(type==='subtract'||type==='alter'){
      const remove=type==='subtract'?base+alter:base;
      for(let i=intervals.length-1;i>=0;i--)if(intervals[i]===remove)intervals.splice(i,1);
    }
    if(type==='add'||type==='alter')intervals.push(base+alter);
  }
  const bass=child(el,'bass'),bassStep=bass&&{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[value(bass,'bass-step')];
  const notes=[...new Set(intervals)].map(i=>48+pc+i);
  if(bassStep!==undefined)notes.unshift(36+(bassStep+num(bass,'bass-alter')+12)%12);
  return notes;
}

export function xmlDocument(xml) {
  if (xml.length > 20_000_000) throw Error('This score is too large (maximum 20 MB).');
  if (/<!ENTITY/i.test(xml)) throw Error('XML entity declarations are not supported. Export a plain MusicXML file.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (all(doc, 'parsererror').length) throw Error('This file is not valid XML. Try exporting MusicXML again.');
  return doc;
}

export function parseMusicXML(xml, {voiceSeparation={}}={}) {
  const doc = normalizeDocument(xmlDocument(xml)), root = doc.documentElement;
  const warnings = new Set(), parts = children(root, 'part'), list = all(root, 'score-part');
  if (!parts.length) throw Error('The score has no musical parts.');
  const lanes = [], rawMeasures = [], tempos = [], rawHarmonies=[], staffGroups=[], writtenRests=[];
  const partData = parts.map((part, pi) => {
    const nameNode = list.find(p => p.getAttribute('id') === part.getAttribute('id'));
    const name = nameNode ? value(nameNode, 'part-name', `Part ${pi+1}`) : `Part ${pi+1}`;
    let divisions = 1, meter = 4, sourceIndex = 0;
    const transposes=new Map();
    const laneMap = new Map();
    const measures = children(part, 'measure').map((measure, mi) => {
      let pos = 0, last = 0, length = 0;
      const notes = [], rests=[];
      const meta = { number: measure.getAttribute('number') || String(mi+1), length: 0, meter, implicit: measure.getAttribute('implicit') === 'yes', forward: false, backward: 0, endings: [], endingStop: false, navigation: [] };
      for (const el of measure.children) {
        const tag = el.localName;
        if (tag === 'attributes') {
          divisions = num(el, 'divisions', divisions);
          if (!(divisions > 0)) throw Error('Invalid rhythmic divisions in the score.');
          const time = child(el, 'time');
          if (time) {
            let pending=0,total=0;
            for(const unit of time.children){
              if(unit.localName==='beats')pending=unit.textContent.split('+').reduce((s,n)=>s+Number(n),0);
              if(unit.localName==='beat-type'){const denominator=Number(unit.textContent);if(denominator>0)total+=pending*4/denominator;pending=0;}
            }
            if(total>0)meter=total;
          }
          for(const trans of children(el,'transpose'))transposes.set(trans.getAttribute('number')||'*',num(trans,'chromatic')+12*num(trans,'octave-change'));
          meta.meter = meter;
        } else if (tag === 'backup') pos = Math.max(0, pos-num(el,'duration')/divisions);
        else if (tag === 'forward') {pos += num(el,'duration')/divisions; length=Math.max(length,pos);}
        else if(tag==='harmony') {const notes=harmonyNotes(el);if(notes.length||value(el,'kind')==='none')rawHarmonies.push({measure:mi,offset:Math.max(0,pos+num(el,'offset')/divisions),notes});else warnings.add('Some chord symbols are displayed without generated accompaniment.');}
        else if (tag === 'direction' || tag === 'sound') {
          const sound = tag === 'sound' ? el : all(el,'sound')[0];
          const offset=Math.max(0,pos+(sound&&child(sound,'offset')?num(sound,'offset'):num(el,'offset'))/divisions);
          if(tag==='direction'&&all(el,'words').some(w=>/^N\.?\s*C\.?$/i.test(w.textContent.trim())))rawHarmonies.push({measure:mi,offset,notes:[]});
          let bpm = Number(sound?.getAttribute('tempo'));
          if(!bpm) {
            const metro = all(el,'metronome')[0];
            if(metro) {
              const units={whole:4,half:2,quarter:1,eighth:.5,'16th':.25};
              bpm=num(metro,'per-minute')*(units[value(metro,'beat-unit')]||1)*(child(metro,'beat-unit-dot')?1.5:1);
            }
          }
          if(bpm>0&&!tempos.some(t=>t.measure===mi&&Math.abs(t.offset-offset)<.00001))tempos.push({measure:mi, offset, bpm:Math.min(600,bpm)});
          for(const mark of tag==='sound'?[el]:all(el,'sound')) {
            const at=Math.max(0,pos+(child(mark,'offset')?num(mark,'offset'):num(el,'offset'))/divisions);
            for(const type of ['segno','coda','dacapo','dalsegno','tocoda','fine'])if(mark.hasAttribute(type))meta.navigation.push({type,value:mark.getAttribute(type),offset:at,timeOnly:mark.getAttribute('time-only')||'',source:'sound'});
            if(mark.getAttribute('forward-repeat')==='yes')meta.forward=true;
          }
          if(tag==='direction')meta.navigation.push(...notationNavigation(el,offset));
        } else if(tag==='note') {
          const noteIndex=sourceIndex++;
          if(child(el,'grace')) {warnings.add('Grace notes and ornaments are displayed but not played.'); continue;}
          const duration=num(el,'duration')/divisions, chord=!!child(el,'chord'), start=chord?last:pos;
          if (!chord) {last=pos;pos+=duration;}
          length=Math.max(length,start+duration,pos);
          const pitch=child(el,'pitch');
          if(pitch && duration>0) {
            const staff=value(el,'staff','1'), voice=value(el,'voice','1'), key=`${staff}:${voice}`;
            if(!/^\d{1,3}$/.test(staff)||Number(staff)<1||Number(staff)>128)throw Error('Invalid staff number in the score.');
            if(!laneMap.has(key)) {const lane={id:`p${pi}-s${staff}-v${voice}`,name,part:pi,staff,voice,notes:[]};laneMap.set(key,lane);lanes.push(lane);}
            const transpose=transposes.get(staff)??transposes.get('*')??0;
            const midi=12*(num(pitch,'octave',4)+1)+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[value(pitch,'step')]??0)+num(pitch,'alter')+transpose;
            if(!Number.isFinite(midi) || midi<0 || midi>127) {warnings.add('Some out-of-range pitches were skipped.');continue;}
            const ties=[...children(el,'tie'),...all(el,'tied')].filter(t=>t.getAttribute('type')!=='let-ring').map(t=>t.getAttribute('type'));
            notes.push({lane:laneMap.get(key).id,start,duration,midi,velocity:.72,lyric:all(el,'lyric').map(l=>all(l,'text').map(t=>t.textContent).join(' ')).join(' / '),tieStart:ties.includes('start')||ties.includes('continue'),tieStop:ties.includes('stop')||ties.includes('continue'),sourceIndex:noteIndex,sourceVoice:voice,stem:value(el,'stem')});
          }
          if(child(el,'rest')&&duration>0)rests.push({start,duration,part:pi,staff:value(el,'staff','1'),sourceVoice:value(el,'voice','1')});
          if(child(el,'unpitched')) warnings.add('Unpitched percussion is not played.');
        } else if(tag==='barline') {
          const repeat=child(el,'repeat');
          if(repeat?.getAttribute('direction')==='forward') meta.forward=true;
          if(repeat?.getAttribute('direction')==='backward') {const times=Number(repeat.getAttribute('times'))||2;meta.backward=Math.min(32,Math.max(2,times));meta.repeatAfterJump=repeat.getAttribute('after-jump')==='yes';if(times>32)warnings.add('A repeat exceeds the playback limit of 32 passes.');}
          meta.navigation.push(...notationNavigation(el,el.getAttribute('location')==='left'?0:pos));
          const ending=child(el,'ending');
          if(ending?.getAttribute('type')==='start') meta.endings=(ending.getAttribute('number')||'').split(/[, ]+/).flatMap(n=>n.includes('-')?Array.from({length:Math.min(32,Number(n.split('-')[1])-Number(n.split('-')[0])+1)},(_,i)=>Number(n.split('-')[0])+i):[Number(n)]).filter(n=>n>0);
          if(ending && ['stop','discontinue'].includes(ending.getAttribute('type'))) meta.endingStop=true;
        }
      }
      meta.length=length || meter;
      if(pi===0) rawMeasures.push(meta);
      else if(rawMeasures[mi]) {
        const raw=rawMeasures[mi];raw.length=Math.max(raw.length,meta.length);
        for(const n of meta.navigation)if(!raw.navigation.some(o=>o.type===n.type&&o.value===n.value&&Math.abs(o.offset-n.offset)<.00001&&o.timeOnly===n.timeOnly&&o.source===n.source))raw.navigation.push(n);
        raw.forward||=meta.forward;raw.backward=Math.max(raw.backward,meta.backward);raw.repeatAfterJump||=meta.repeatAfterJump;
        if(meta.endings.length)raw.endings=[...new Set([...raw.endings,...meta.endings])];raw.endingStop||=meta.endingStop;
      }
      return {notes,rests,meta};
    });
    if(laneMap.size>1) for(const lane of laneMap.values()) lane.name=`${name} · staff ${lane.staff}, voice ${lane.voice}`;
    return measures;
  });
  if(!lanes.length) throw Error('No pitched notes were found in this score.');
  for(const warning of resolveNavigation(rawMeasures))warnings.add(warning);
  let beat=0, activeEnding=[];
  for(const m of rawMeasures) {m.start=beat;beat+=m.length;if(m.endings.length)activeEnding=m.endings;m.allowed=activeEnding;if(m.endingStop)activeEnding=[];}
  for(const measures of partData)for(let mi=0;mi<measures.length;mi++)for(const rest of measures[mi].rests)writtenRests.push({...rest,start:rest.start+(rawMeasures[mi]?.start||0)});
  for(const warning of navigationWarnings(rawMeasures))warnings.add(warning);
  for (const measures of partData) for(let mi=0;mi<measures.length;mi++) for(const note of measures[mi].notes) {
    const lane=lanes.find(l=>l.id===note.lane);lane.notes.push({...note,start:note.start+(rawMeasures[mi]?.start||0)});
  }
  // OCR exports sometimes change a melody's voice number for one isolated bar.
  // Join only tiny, non-overlapping fragments; genuine divisi voices remain separate.
  for(const part of new Set(lanes.map(l=>l.part)))for(const staff of new Set(lanes.filter(l=>l.part===part).map(l=>l.staff))){
    const group=lanes.filter(l=>l.part===part&&l.staff===staff&&!l.generated).sort((a,b)=>b.notes.length-a.notes.length),main=group[0];
    if(!main)continue;
    for(const fragment of group.slice(1)){
      const overlaps=fragment.notes.some(n=>main.notes.some(o=>o.start<n.start+n.duration-.00001&&o.start+o.duration>n.start+.00001));
      if(!overlaps&&fragment.notes.length<=8&&fragment.notes.length<main.notes.length*.12){main.notes.push(...fragment.notes.map(n=>({...n,lane:main.id})));main.sourceVoices=[...new Set([...(main.sourceVoices||[main.voice]),...(fragment.sourceVoices||[fragment.voice])])];lanes.splice(lanes.indexOf(fragment),1);warnings.add('A sparse MusicXML voice-number change was joined to the main line. Review the detected parts before publishing.');}
    }
    main.notes.sort((a,b)=>a.start-b.start);
  }
  for(const part of new Set(lanes.map(l=>l.part))){const remaining=lanes.filter(l=>l.part===part&&!l.generated);if(remaining.length===1)remaining[0].name=remaining[0].name.split(' · staff ')[0];}
  for(const part of new Set(lanes.map(l=>l.part)))for(const staff of new Set(lanes.filter(l=>l.part===part).map(l=>l.staff))) {
    const group=lanes.filter(l=>l.part===part&&l.staff===staff),name=group[0].name.split(' · staff ')[0],id=`p${part}-s${staff}`;
    const setting=voiceSeparation[id],mode=String(typeof setting==='object'?setting?.count:setting||'auto'),unisons=setting?.unisons!==false;
    const definition=list.find(p=>p.getAttribute('id')===parts[part].getAttribute('id'));
    const instrument=all(definition||parts[part],'midi-program').some(n=>[53,54,55].includes(Number(n.textContent)));
    const instrumental=/piano|pianoforte|keyboard|organ|guitar|violin|viola|cello|double bass|contrabass|flute|clarinet|trumpet|trombone|orchestra|continuo/i.test(name);
    const vocal=!instrumental&&(instrument||/soprano|sopraan|alto|alt\b|tenor|bass|bas\b|choir|chorus|koor|vocal|voice|voices|satb|ssaa|ttbb|cant(us|o)|women|men\b|mannen|vrouwen/i.test(name)||(/^(part|staff|music|melody|untitled)/i.test(name)&&group.some(l=>l.notes.some(n=>n.lyric))));
    const notes=group.flatMap(l=>l.notes),detected=inferredVoiceCount(notes);
    const count=['2','3','4'].includes(mode)?Number(mode):mode==='auto'&&vocal&&group.some(l=>inferredVoiceCount(l.notes)>1)?Math.max(detected,Math.min(4,group.length)):1;
    let result=group;
    if(count>1) {
      const {voices,crowded}=separateVoiceNotes(notes,count,{unisons,rests:writtenRests.filter(r=>r.part===part&&r.staff===staff)});
      const lower=name.toLowerCase(),names=count===2&&(/sopran|sopraan/.test(lower)&&/alto|alt\b/.test(lower)||/vrouwen|women/.test(lower))?['Soprano','Alto']:count===2&&(/tenor/.test(lower)&&/bass|bas\b/.test(lower)||/mannen|men\b/.test(lower))?['Tenor','Bass']:Array.from({length:count},(_,i)=>`${name} · ${count===2?(i===0?'upper voice':'lower voice'):'voice '+(i+1)}`);
      result=voices.map((voiceNotes,i)=>({id:`${id}-split${i+1}`,name:names[i],part,staff,voice:String(i+1),sourceVoices:[...new Set(voiceNotes.map(n=>n.sourceVoice))],sourceNoteIndices:voiceNotes.map(n=>n.sourceIndex),separated:true,notes:voiceNotes.map(n=>({...n,lane:`${id}-split${i+1}`}))})).filter(l=>l.notes.length);
      const index=lanes.indexOf(group[0]);for(const lane of group)lanes.splice(lanes.indexOf(lane),1);lanes.splice(index,0,...result);
      warnings.add('Shared-staff voices were inferred. Review the parts; ambiguous crossings and solo passages may need a different separation setting.');
      if(crowded)warnings.add('Some notes overlap within an inferred voice. Increase the voice count or keep the written parts to retain instrumental chords.');
    }
    staffGroups.push({id,part,staff,name,writtenVoices:group.length,voices:result.length,mode});
  }
  // Join ties only after assigning their individual written notes to singing lines.
  for(const lane of lanes) {
    lane.notes.sort((a,b)=>a.start-b.start);const held=new Map(),merged=[];
    for(const n of lane.notes){const prev=held.get(n.midi);if(n.tieStop&&prev&&Math.abs(prev.start+prev.duration-n.start)<.001){prev.duration+=n.duration;prev.tieStart=n.tieStart;if(!n.tieStart)held.delete(n.midi);}else{merged.push(n);if(n.tieStart)held.set(n.midi,n);else held.delete(n.midi);}}
    lane.notes=merged;
  }
  const harmonies=[];for(const h of rawHarmonies){const start=(rawMeasures[h.measure]?.start||0)+h.offset,key=`${start.toFixed(4)}:${h.notes.join(',')}`;if(!harmonies.some(x=>x.key===key))harmonies.push({...h,start,key});}
  harmonies.sort((a,b)=>a.start-b.start);if(harmonies.length){const notes=[];for(let i=0;i<harmonies.length;i++){const h=harmonies[i],measureEnd=(rawMeasures[h.measure]?.start||0)+(rawMeasures[h.measure]?.length||4),end=Math.max(h.start,Math.min(harmonies[i+1]?.start??measureEnd,measureEnd));for(const midi of h.notes)notes.push({start:h.start,duration:end-h.start,midi,velocity:.48,lyric:''});}lanes.push({id:'chords',name:'Chord accompaniment',notes,partType:'instrument',sound:'piano',generated:true,published:true});}
  if(all(root,'ornaments').length) warnings.add('Grace notes and ornaments are displayed but not played.');
  if(all(root,'fermata').length) warnings.add('Fermatas use their written duration.');
  if(all(root,'measure-repeat').length) warnings.add('Measure-repeat symbols require explicitly written notes for playback.');
  const tempoMap=tempos.map(t=>({beat:(rawMeasures[t.measure]?.start||0)+t.offset,bpm:t.bpm})).sort((a,b)=>a.beat-b.beat);
  if(!tempoMap.length || tempoMap[0].beat>0)tempoMap.unshift({beat:0,bpm:100});
  return {title:all(root,'work-title')[0]?.textContent || value(root,'movement-title','Untitled score'),composer:all(root,'creator').find(c=>c.getAttribute('type')==='composer')?.textContent||'',lanes,measures:rawMeasures,tempos:tempoMap,totalBeats:beat,warnings:[...warnings],format:'MusicXML',staffGroups,importerVersion:2};
}

export function normalizeMusicXML(xml) {
  const source=xmlDocument(xml),normalized=normalizeDocument(source);
  return normalized===source?xml:'<?xml version="1.0" encoding="UTF-8"?>'+new XMLSerializer().serializeToString(normalized);
}

function decodeXML(bytes) {
  let encoding='utf-8';
  if(bytes[0]===255&&bytes[1]===254||bytes[0]===60&&bytes[1]===0)encoding='utf-16le';
  else if(bytes[0]===254&&bytes[1]===255||bytes[0]===0&&bytes[1]===60)encoding='utf-16be';
  else encoding=new TextDecoder().decode(bytes.slice(0,250)).match(/<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i)?.[1]||encoding;
  try{return new TextDecoder(encoding).decode(bytes);}catch{throw Error(`The score uses an unsupported text encoding: ${encoding}.`);}
}

export function playbackOrder(measures, repeats=true) {
  return playbackRoute(measures,repeats).map(s=>s.measure);
}

export function createTimeline(score, repeats=true) {
  score=arrangedScore(score);
  let seconds=0;const segments=[],events=[];
  const tempoAt=beat=>score.tempos.filter(t=>t.beat<=beat+.00001).at(-1)?.bpm||100;
  for(const route of playbackRoute(score.measures,repeats)) {
    const mi=route.measure,measure=score.measures[mi],first=measure.start+route.from,last=measure.start+route.to;
    const cuts=[first,...score.tempos.filter(t=>t.beat>first&&t.beat<last).map(t=>t.beat),last];
    for(let c=0;c<cuts.length-1;c++) {const bpm=tempoAt(cuts[c]),duration=(cuts[c+1]-cuts[c])*60/bpm;segments.push({time:seconds,duration,beat:cuts[c],beats:cuts[c+1]-cuts[c],bpm,measure:mi});seconds+=duration;}
  }
  // Clip tied notes at navigation jumps; carry through adjacent written measures.
  for(let si=0;si<segments.length;si++){
    const seg=segments[si];
    for(const lane of score.lanes.filter(l=>!l.removed)) {const own=lane.notes||[],source=lane.collectiveWith&&score.lanes.find(l=>l.id===lane.collectiveWith&&!l.removed),joined=source?(source.notes||[]).filter(n=>!own.some(o=>o.start<n.start+n.duration-.00001&&o.start+o.duration>n.start+.00001)).map(n=>({...n,midi:n.midi+(lane.collectiveTranspose||0)})):[];for(const n of [...own,...joined]) {
      const onset=Math.max(n.start,seg.beat),previous=segments[si-1],enter=n.start<seg.beat-.00001&&n.start+n.duration>seg.beat+.00001&&(!previous||Math.abs(previous.beat+previous.beats-seg.beat)>.001);
      if(!(n.start>=seg.beat-.00001||enter)||onset>=seg.beat+seg.beats-.00001)continue;
      let remain=n.duration-(onset-n.start), j=si, cursor=onset, duration=0;
      while(remain>.00001 && j<segments.length){const s=segments[j],take=Math.min(remain,s.beat+s.beats-cursor);if(take<=0)break;duration+=take*60/s.bpm;remain-=take;const next=segments[j+1];if(!next || Math.abs(next.beat-(s.beat+s.beats))>.001)break;cursor=next.beat;j++;}
      events.push({...n,lane:lane.id,time:seg.time+(onset-seg.beat)*60/seg.bpm,seconds:duration});
    }}
  }
  events.sort((a,b)=>a.time-b.time);
  return {segments,events,duration:seconds};
}

export function positionAt(timeline,time) {
  const s=timeline.segments.find(s=>time<s.time+s.duration-.000001)||timeline.segments.at(-1);
  return s?{beat:s.beat+Math.max(0,Math.min(s.duration,time-s.time))*s.bpm/60,measure:s.measure,bpm:s.bpm}:{beat:0,measure:0,bpm:100};
}

function midiXML(score) {
  const noteXML=(midi,duration,tieStart=false,tieStop=false,chord=false)=> {
    const step=['C','C','D','D','E','F','F','G','G','A','A','B'][midi%12],alter=[1,3,6,8,10].includes(midi%12)?'<alter>1</alter>':'';
    const pitch=midi===null?'<rest/>':`<pitch><step>${step}</step>${alter}<octave>${Math.floor(midi/12)-1}</octave></pitch>`;
    return `<note>${chord?'<chord/>':''}${pitch}<duration>${duration}</duration>${tieStop?'<tie type="stop"/>':''}${tieStart?'<tie type="start"/>':''}<voice>1</voice>${tieStart||tieStop?`<notations>${tieStop?'<tied type="stop"/>':''}${tieStart?'<tied type="start"/>':''}</notations>`:''}</note>`;
  };
  const splitDur=(midi,duration,contIn,contOut,chord=false)=>{
    let out='',remaining=duration,first=true;
    for(const unit of [16,12,8,6,4,3,2,1])while(remaining>=unit){remaining-=unit;out+=noteXML(midi,unit,midi!==null&&(remaining>0||contOut),midi!==null&&(!first||contIn),chord&&first);first=false;}
    return out;
  };
  const parts=score.lanes.map((lane,pi)=>`<part id="P${pi}">${score.measures.map((m,mi)=>{
    let content=mi===0?`<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>${lane.notes.reduce((s,n)=>s+n.midi,0)/lane.notes.length<60?'F':'G'}</sign><line>${lane.notes.reduce((s,n)=>s+n.midi,0)/lane.notes.length<60?'4':'2'}</line></clef></attributes>`:'';
    // Quantized voices are placed with backup/forward; this retains overlaps without inventing voice leading.
    const ns=lane.notes.map(n=>({...n,qStart:Math.round(n.start*4),qEnd:Math.max(Math.round(n.start*4)+1,Math.round((n.start+n.duration)*4))})).filter(n=>n.qStart<(mi+1)*16 && n.qEnd>mi*16);
    if(!ns.length)content+=splitDur(null,16,false,false);
    let pos=0;
    for(const n of ns){const start=Math.max(n.qStart,mi*16)-mi*16,end=Math.min(n.qEnd,(mi+1)*16)-mi*16;if(pos>start)content+=`<backup><duration>${pos-start}</duration></backup>`;if(pos<start)content+=`<forward><duration>${start-pos}</duration></forward>`;content+=splitDur(n.midi,end-start,n.qStart<mi*16,n.qEnd>(mi+1)*16);pos=end;}
    return `<measure number="${mi+1}">${content}</measure>`;
  }).join('')}</part>`).join('');
  return `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>${escapeXML(score.title)}</work-title></work><part-list>${score.lanes.map((l,i)=>`<score-part id="P${i}"><part-name>${escapeXML(l.name)}</part-name></score-part>`).join('')}</part-list>${parts}</score-partwise>`;
}

export function parseMidi(bytes, name='MIDI score') {
  if(bytes[9]===2)throw Error('This MIDI file contains independent patterns (type 2). Export a type 0 or type 1 MIDI file instead.');
  if(bytes[12]&128)throw Error('SMPTE-time MIDI is not supported. Export a beat-based MIDI file.');
  const midi=new Midi(bytes), ppq=midi.header.ppq;
  const lanes=midi.tracks.filter(t=>t.notes.length && !t.instrument.percussion).map((t,i)=>({id:`m${i}`,name:t.name||t.instrument.name||`Part ${i+1}`,notes:t.notes.map(n=>({start:n.ticks/ppq,duration:n.durationTicks/ppq,midi:n.midi,velocity:n.velocity,lyric:''}))}));
  if(!lanes.length)throw Error('No pitched notes were found in this MIDI file.');
  const end=Math.max(...lanes.map(l=>l.notes.reduce((max,n)=>Math.max(max,n.start+n.duration),0))), count=Math.ceil(end/4);
  if(count>2000)throw Error('This MIDI file is too long (maximum 2,000 bars).');
  const score={title:midi.name||name.replace(/\.[^.]+$/,''),composer:'',lanes,measures:Array.from({length:count},(_,i)=>({number:String(i+1),start:i*4,length:4,meter:4,allowed:[]})),tempos:midi.header.tempos.map(t=>({beat:t.ticks/ppq,bpm:t.bpm})),totalBeats:count*4,format:'MIDI',warnings:['MIDI notation is reconstructed in 4/4, rounded to sixteenth notes. Audio keeps the original timing and tempo; lyrics, key signatures and phrasing are unavailable.']};
  if(!score.tempos.length || score.tempos[0].beat>0)score.tempos.unshift({beat:0,bpm:120});
  if(midi.tracks.some(t=>t.instrument.percussion))score.warnings.push('Percussion tracks are omitted.');
  if(midi.tracks.some(t=>t.pitchBends.length || Object.keys(t.controlChanges).length))score.warnings.push('MIDI controllers, sustain pedal and pitch bends are not reproduced.');
  return {score,xml:midiXML(score)};
}

export async function readScoreFile(file) {
  if(file.size>20_000_000)throw Error('Files must be smaller than 20 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes[0]===77 && bytes[1]===84 && bytes[2]===104 && bytes[3]===100){const {score,xml}=parseMidi(bytes,file.name);return {score,xml,source:btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')),kind:'midi'};}
  let xml;
  if(bytes[0]===80 && bytes[1]===75){
    let total=0;
    const entries=unzipSync(bytes,{filter:entry=>{total+=entry.originalSize;if(entry.originalSize>20_000_000 || total>50_000_000)throw Error('The compressed score expands beyond the size limit.');return true;}});
    const container=entries['META-INF/container.xml'];
    let path;
    if(container){const doc=xmlDocument(decodeXML(container));path=all(doc,'rootfile').find(n=>n.getAttribute('media-type')==='application/vnd.recordare.musicxml+xml')?.getAttribute('full-path')||all(doc,'rootfile')[0]?.getAttribute('full-path');}
    path=path||Object.keys(entries).find(n=>/\.(musicxml|xml)$/i.test(n)&&!n.startsWith('META-INF/'));
    if(path)path=path.replace(/^\.\//,'').replaceAll('\\','/');
    if(!entries[path]){try{path=decodeURIComponent(path);}catch{}}
    if(!entries[path])throw Error('The compressed file does not contain a MusicXML score.');xml=decodeXML(entries[path]);
  } else xml=decodeXML(bytes);
  const source=xml;xml=normalizeMusicXML(xml);
  return {score:parseMusicXML(xml),xml,source,kind:'musicxml'};
}

export function demoXML(title='Evening round', variant=0) {
  const melodies=[[72,71,69,67,69,71,72,74,76,74,72,71,69,67,71,72],[64,67,65,64,65,67,64,67,69,67,64,62,65,64,62,64],[60,62,60,59,60,62,60,62,64,62,60,59,60,59,59,60],[48,55,53,48,53,55,48,55,57,55,48,55,53,48,55,48]];
  return `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>${title}</work-title></work><identification><creator type="composer">Concentavo · original exercise</creator></identification><part-list>${['Soprano','Alto','Tenor','Bass'].map((name,i)=>`<score-part id="P${i}"><part-name>${name}</part-name><part-abbreviation>${name[0]}</part-abbreviation></score-part>`).join('')}</part-list>${melodies.map((mel,i)=>`<part id="P${i}">${mel.map((m,j)=>{const midi=m+(variant?2:0),steps=['C','C','D','D','E','F','F','G','G','A','A','B'];return `<measure number="${j+1}">${j===0?`<attributes><divisions>1</divisions><key><fifths>${variant?2:0}</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>${i>1?'F':'G'}</sign><line>${i>1?4:2}</line></clef></attributes><direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${variant?88:104}</per-minute></metronome></direction-type><sound tempo="${variant?88:104}"/></direction>`:''}<note><pitch><step>${steps[midi%12]}</step>${[1,3,6,8,10].includes(midi%12)?'<alter>1</alter>':''}<octave>${Math.floor(midi/12)-1}</octave></pitch><duration>4</duration><type>whole</type><lyric><text>${j===15?'ah':'lu'}</text></lyric></note></measure>`;}).join('')}</part>`).join('')}</score-partwise>`;
}
