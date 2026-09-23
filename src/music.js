import { unzipSync, strFromU8 } from 'fflate';
import { Midi } from '@tonejs/midi';

const children = (n, tag) => Array.from(n.children).filter(x => x.localName === tag);
const child = (n, tag) => children(n, tag)[0];
const value = (n, tag, fallback = '') => child(n, tag)?.textContent?.trim() || fallback;
const num = (n, tag, fallback = 0) => Number(value(n, tag, String(fallback)));
const all = (n, tag) => Array.from(n.getElementsByTagNameNS('*', tag));
export const escapeXML = s => String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export const uid = () => crypto.randomUUID();
const chordIntervals=kind=>({minor:[0,3,7],diminished:[0,3,6],augmented:[0,4,8],dominant:[0,4,7,10],'major-seventh':[0,4,7,11],'minor-seventh':[0,3,7,10],'half-diminished':[0,3,6,10],suspended_second:[0,2,7],suspended_fourth:[0,5,7]}[kind]||[0,4,7]);
function harmonyNotes(el){const root=child(el,'root'),step={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[value(root,'root-step')];if(step===undefined)return [];const pc=(step+num(root,'root-alter')+12)%12,kind=value(el,'kind','major'),intervals=chordIntervals(kind);for(const degree of children(el,'degree')){const n=num(degree,'degree-value'),alter=num(degree,'degree-alter'),type=value(degree,'degree-type');const base={2:2,4:5,6:9,7:kind.includes('major')?11:10,9:14,11:17,13:21}[n];if(base!==undefined&&type==='add')intervals.push(base+alter);}const bass=child(el,'bass'),bassStep=bass&&{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[value(bass,'bass-step')];const notes=[...new Set(intervals)].map(i=>48+pc+i);if(bassStep!==undefined)notes.unshift(36+(bassStep+num(bass,'bass-alter')+12)%12);return notes;}

export function xmlDocument(xml) {
  if (xml.length > 20_000_000) throw Error('This score is too large (maximum 20 MB).');
  if (/<!ENTITY/i.test(xml)) throw Error('XML entity declarations are not supported. Export a plain MusicXML file.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (all(doc, 'parsererror').length) throw Error('This file is not valid XML. Try exporting MusicXML again.');
  return doc;
}

export function parseMusicXML(xml) {
  const doc = xmlDocument(xml), root = doc.documentElement;
  if (root.localName !== 'score-partwise') throw Error('Please use partwise MusicXML. In your notation program, export as MusicXML (.musicxml or .mxl).');
  const warnings = new Set(), parts = children(root, 'part'), list = all(root, 'score-part');
  if (!parts.length) throw Error('The score has no musical parts.');
  const lanes = [], rawMeasures = [], tempos = [], rawHarmonies=[];
  const partData = parts.map((part, pi) => {
    const nameNode = list.find(p => p.getAttribute('id') === part.getAttribute('id'));
    const name = nameNode ? value(nameNode, 'part-name', `Part ${pi+1}`) : `Part ${pi+1}`;
    let divisions = 1, meter = 4, transpose = 0;
    const laneMap = new Map();
    const measures = children(part, 'measure').map((measure, mi) => {
      let pos = 0, last = 0, length = 0;
      const notes = [];
      const meta = { number: measure.getAttribute('number') || String(mi+1), length: 0, meter, implicit: measure.getAttribute('implicit') === 'yes', forward: false, backward: 0, endings: [], endingStop: false };
      for (const el of measure.children) {
        const tag = el.localName;
        if (tag === 'attributes') {
          divisions = num(el, 'divisions', divisions);
          if (!(divisions > 0)) throw Error('Invalid rhythmic divisions in the score.');
          const time = child(el, 'time');
          if (time) {
            const beats = children(time, 'beats').reduce((sum,b) => sum + b.textContent.split('+').reduce((s,n)=>s+Number(n),0),0);
            const denominator = num(time,'beat-type',4);
            if (beats > 0 && denominator > 0) meter = beats*4/denominator;
          }
          const trans = child(el,'transpose');
          if(trans) transpose = num(trans,'chromatic') + 12*num(trans,'octave-change');
          meta.meter = meter;
        } else if (tag === 'backup') pos = Math.max(0, pos-num(el,'duration')/divisions);
        else if (tag === 'forward') {pos += num(el,'duration')/divisions; length=Math.max(length,pos);}
        else if(tag==='harmony') {const notes=harmonyNotes(el);if(notes.length)rawHarmonies.push({measure:mi,offset:Math.max(0,pos+num(el,'offset')/divisions),notes});}
        else if (tag === 'direction' || tag === 'sound') {
          const sound = tag === 'sound' ? el : all(el,'sound')[0];
          let bpm = Number(sound?.getAttribute('tempo'));
          if(!bpm) {
            const metro = all(el,'metronome')[0];
            if(metro) {
              const units={whole:4,half:2,quarter:1,eighth:.5,'16th':.25};
              bpm=num(metro,'per-minute')*(units[value(metro,'beat-unit')]||1)*(child(metro,'beat-unit-dot')?1.5:1);
            }
          }
          if (pi===0 && bpm>0) tempos.push({measure:mi, offset:Math.max(0,pos+num(el,'offset')/divisions), bpm:Math.min(600,bpm)});
          if(sound && ['dacapo','dalsegno','tocoda','fine'].some(a=>sound.hasAttribute(a))) warnings.add('D.C., D.S. and coda jumps are not expanded. Use an unfolded score for exact playback.');
        } else if(tag==='note') {
          if(child(el,'grace')) {warnings.add('Grace notes and ornaments are displayed but not played.'); continue;}
          const duration=num(el,'duration')/divisions, chord=!!child(el,'chord'), start=chord?last:pos;
          if (!chord) {last=pos;pos+=duration;}
          length=Math.max(length,start+duration,pos);
          const pitch=child(el,'pitch');
          if(pitch && duration>0) {
            const staff=value(el,'staff','1'), voice=value(el,'voice','1'), key=`${staff}:${voice}`;
            if(!laneMap.has(key)) {const lane={id:`p${pi}-s${staff}-v${voice}`,name,part:pi,staff,voice,notes:[]};laneMap.set(key,lane);lanes.push(lane);}
            const midi=12*(num(pitch,'octave',4)+1)+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[value(pitch,'step')]??0)+num(pitch,'alter')+transpose;
            if(!Number.isFinite(midi) || midi<0 || midi>127) {warnings.add('Some out-of-range pitches were skipped.');continue;}
            const ties=children(el,'tie').map(t=>t.getAttribute('type'));
            notes.push({lane:laneMap.get(key).id,start,duration,midi,velocity:.72,lyric:all(el,'lyric').map(l=>all(l,'text').map(t=>t.textContent).join(' ')).join(' / '),tieStart:ties.includes('start'),tieStop:ties.includes('stop')});
          }
          if(child(el,'unpitched')) warnings.add('Unpitched percussion is not played.');
        } else if(tag==='barline') {
          const repeat=child(el,'repeat');
          if(repeat?.getAttribute('direction')==='forward') meta.forward=true;
          if(repeat?.getAttribute('direction')==='backward') meta.backward=Math.min(8,Math.max(2,Number(repeat.getAttribute('times'))||2));
          const ending=child(el,'ending');
          if(ending?.getAttribute('type')==='start') meta.endings=(ending.getAttribute('number')||'').split(/[, ]+/).flatMap(n=>n.includes('-')?Array.from({length:Math.min(8,Number(n.split('-')[1])-Number(n.split('-')[0])+1)},(_,i)=>Number(n.split('-')[0])+i):[Number(n)]).filter(n=>n>0);
          if(ending && ['stop','discontinue'].includes(ending.getAttribute('type'))) meta.endingStop=true;
        }
      }
      meta.length=length || meter;
      if(pi===0) rawMeasures.push(meta);
      else if(rawMeasures[mi]) rawMeasures[mi].length=Math.max(rawMeasures[mi].length,meta.length);
      return {notes,meta};
    });
    if(laneMap.size>1) for(const lane of laneMap.values()) lane.name=`${name} · staff ${lane.staff}, voice ${lane.voice}`;
    return measures;
  });
  if(!lanes.length) throw Error('No pitched notes were found in this score.');
  let beat=0, activeEnding=[];
  for(const m of rawMeasures) {m.start=beat;beat+=m.length;if(m.endings.length)activeEnding=m.endings;m.allowed=activeEnding;if(m.endingStop)activeEnding=[];}
  for (const measures of partData) for(let mi=0;mi<measures.length;mi++) for(const note of measures[mi].notes) {
    const lane=lanes.find(l=>l.id===note.lane);lane.notes.push({...note,start:note.start+(rawMeasures[mi]?.start||0)});
  }
  for(const lane of lanes) {
    lane.notes.sort((a,b)=>a.start-b.start); const held=new Map(), merged=[];
    for(const n of lane.notes) {const prev=held.get(n.midi);if(n.tieStop && prev && Math.abs(prev.start+prev.duration-n.start)<.001){prev.duration+=n.duration;if(!n.tieStart)held.delete(n.midi);}else{merged.push(n);if(n.tieStart)held.set(n.midi,n);else held.delete(n.midi);}}
    lane.notes=merged;
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
  const harmonies=[];for(const h of rawHarmonies){const start=(rawMeasures[h.measure]?.start||0)+h.offset,key=`${start.toFixed(4)}:${h.notes.join(',')}`;if(!harmonies.some(x=>x.key===key))harmonies.push({...h,start,key});}
  harmonies.sort((a,b)=>a.start-b.start);if(harmonies.length){const notes=[];for(let i=0;i<harmonies.length;i++){const h=harmonies[i],measureEnd=(rawMeasures[h.measure]?.start||0)+(rawMeasures[h.measure]?.length||4),end=Math.max(h.start+.25,Math.min(harmonies[i+1]?.start??measureEnd,measureEnd));for(const midi of h.notes)notes.push({start:h.start,duration:end-h.start,midi,velocity:.48,lyric:''});}lanes.push({id:'chords',name:'Chord accompaniment',notes,partType:'instrument',sound:'piano',generated:true,published:true});}
  if(all(root,'ornaments').length) warnings.add('Grace notes and ornaments are displayed but not played.');
  if(all(root,'fermata').length) warnings.add('Fermatas use their written duration.');
  if(all(root,'measure-repeat').length) warnings.add('Measure-repeat symbols require explicitly written notes for playback.');
  const tempoMap=tempos.map(t=>({beat:(rawMeasures[t.measure]?.start||0)+t.offset,bpm:t.bpm})).sort((a,b)=>a.beat-b.beat);
  if(!tempoMap.length || tempoMap[0].beat>0)tempoMap.unshift({beat:0,bpm:100});
  return {title:all(root,'work-title')[0]?.textContent || value(root,'movement-title','Untitled score'),composer:all(root,'creator').find(c=>c.getAttribute('type')==='composer')?.textContent||'',lanes,measures:rawMeasures,tempos:tempoMap,totalBeats:beat,warnings:[...warnings],format:'MusicXML'};
}

export function playbackOrder(measures, repeats=true) {
  const order=[]; let i=0,start=0,pass=1,steps=0; const counts=new Map();
  while(i<measures.length && steps++<measures.length*32) {
    const m=measures[i];
    if(m.forward){start=i; if(!counts.has(i))pass=1;}
    if(!repeats || !m.allowed?.length || m.allowed.includes(pass))order.push(i);
    if(repeats && m.backward) {
      const count=counts.get(i)||1;
      if(count<m.backward){counts.set(i,count+1);counts.set(start,count+1);pass=count+1;i=start;continue;}
      counts.delete(i);start=i+1;
    }
    i++;
  }
  return order;
}

export function createTimeline(score, repeats=true) {
  let seconds=0;const segments=[],events=[];
  const tempoAt=beat=>score.tempos.filter(t=>t.beat<=beat+.00001).at(-1)?.bpm||100;
  for(const mi of playbackOrder(score.measures,repeats)) {
    const measure=score.measures[mi], cuts=[measure.start,...score.tempos.filter(t=>t.beat>measure.start && t.beat<measure.start+measure.length).map(t=>t.beat),measure.start+measure.length];
    for(let c=0;c<cuts.length-1;c++) {const bpm=tempoAt(cuts[c]),duration=(cuts[c+1]-cuts[c])*60/bpm;segments.push({time:seconds,duration,beat:cuts[c],beats:cuts[c+1]-cuts[c],bpm,measure:mi});seconds+=duration;}
  }
  // Clip tied notes at navigation jumps; carry through adjacent written measures.
  for(let si=0;si<segments.length;si++){
    const seg=segments[si];
    for(const lane of score.lanes) {const own=lane.notes||[],source=lane.collectiveWith&&score.lanes.find(l=>l.id===lane.collectiveWith),joined=source?(source.notes||[]).filter(n=>!own.some(o=>o.start<n.start+n.duration-.00001&&o.start+o.duration>n.start+.00001)).map(n=>({...n,midi:n.midi+(lane.collectiveTranspose||0)})):[];for(const n of [...own,...joined]) if(n.start>=seg.beat-.00001 && n.start<seg.beat+seg.beats-.00001) {
      let remain=n.duration, j=si, cursor=n.start, duration=0;
      while(remain>.00001 && j<segments.length){const s=segments[j],take=Math.min(remain,s.beat+s.beats-cursor);if(take<=0)break;duration+=take*60/s.bpm;remain-=take;const next=segments[j+1];if(!next || Math.abs(next.beat-(s.beat+s.beats))>.001)break;cursor=next.beat;j++;}
      events.push({...n,lane:lane.id,time:seg.time+(n.start-seg.beat)*60/seg.bpm,seconds:duration});
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
    if(container){const doc=xmlDocument(strFromU8(container));path=all(doc,'rootfile').find(n=>n.getAttribute('media-type')==='application/vnd.recordare.musicxml+xml')?.getAttribute('full-path')||all(doc,'rootfile')[0]?.getAttribute('full-path');}
    path=path||Object.keys(entries).find(n=>/\.(musicxml|xml)$/i.test(n)&&!n.startsWith('META-INF/'));
    if(!entries[path])throw Error('The compressed file does not contain a MusicXML score.');xml=strFromU8(entries[path]);
  } else xml=new TextDecoder().decode(bytes);
  return {score:parseMusicXML(xml),xml,source:xml,kind:'musicxml'};
}

export function demoXML(title='Evening round', variant=0) {
  const melodies=[[72,71,69,67,69,71,72,74,76,74,72,71,69,67,71,72],[64,67,65,64,65,67,64,67,69,67,64,62,65,64,62,64],[60,62,60,59,60,62,60,62,64,62,60,59,60,59,59,60],[48,55,53,48,53,55,48,55,57,55,48,55,53,48,55,48]];
  return `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>${title}</work-title></work><identification><creator type="composer">Concentavo · original exercise</creator></identification><part-list>${['Soprano','Alto','Tenor','Bass'].map((name,i)=>`<score-part id="P${i}"><part-name>${name}</part-name><part-abbreviation>${name[0]}</part-abbreviation></score-part>`).join('')}</part-list>${melodies.map((mel,i)=>`<part id="P${i}">${mel.map((m,j)=>{const midi=m+(variant?2:0),steps=['C','C','D','D','E','F','F','G','G','A','A','B'];return `<measure number="${j+1}">${j===0?`<attributes><divisions>1</divisions><key><fifths>${variant?2:0}</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>${i>1?'F':'G'}</sign><line>${i>1?4:2}</line></clef></attributes><direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${variant?88:104}</per-minute></metronome></direction-type><sound tempo="${variant?88:104}"/></direction>`:''}<note><pitch><step>${steps[midi%12]}</step>${[1,3,6,8,10].includes(midi%12)?'<alter>1</alter>':''}<octave>${Math.floor(midi/12)-1}</octave></pitch><duration>4</duration><type>whole</type><lyric><text>${j===15?'ah':'lu'}</text></lyric></note></measure>`;}).join('')}</part>`).join('')}</score-partwise>`;
}
