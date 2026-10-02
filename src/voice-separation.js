const EPS = .00001;
const median = values => { const sorted = [...values].sort((a,b)=>a-b); return sorted[Math.floor(sorted.length/2)]; };

export function onsetGroups(notes) {
  const groups=[];
  for(const note of [...notes].sort((a,b)=>a.start-b.start||b.midi-a.midi)) {
    const last=groups.at(-1);
    if(last && Math.abs(last[0].start-note.start)<EPS)last.push(note);
    else groups.push([note]);
  }
  return groups;
}

// Retain a small set of competing phrase assignments rather than greedily sorting
// every chord: a held note, a tie or the next onset can resolve an ambiguous leap.
export function separateVoiceNotes(notes, count, {unisons=true}={}) {
  if(!Number.isInteger(count)||count<2||count>4)throw Error('Choose two, three or four voices.');
  const groups=onsetGroups(notes),full=groups.filter(g=>g.length>=count);
  const anchors=Array.from({length:count},(_,i)=>median(full.map(g=>g[Math.min(i,g.length-1)].midi))??(72-i*7));
  const sourceVoices=[...new Set(notes.map(n=>n.sourceVoice))];
  const voiceOrder=sourceVoices.map(voice=>({voice,pitch:median(notes.filter(n=>n.sourceVoice===voice).map(n=>n.midi))})).sort((a,b)=>b.pitch-a.pitch);
  const hint=new Map(voiceOrder.map((v,i)=>[v.voice,i]));
  let beam=[{cost:0,states:Array.from({length:count},()=>({end:-Infinity,pitch:null,tie:false})),path:null}];
  let crowded=false;
  for(const group of groups) {
    const start=group[0].start,next=[],mixedStems=group.some(n=>n.stem==='up')&&group.some(n=>n.stem==='down');
    // Extra chord tones are retained in the nearest line, never silently dropped.
    const leading=group.slice(0,count),extras=group.slice(count);
    if(extras.length)crowded=true;
    for(const state of beam) {
      const shared=unisons&&sourceVoices.length===1&&group.length===1&&state.states.every(s=>s.end<=start+EPS);
      const candidates=[];
      if(shared)candidates.push(Array.from({length:count},(_,i)=>[group[0],i]));
      else {
        const assign=(index,used,pairs)=>{
          if(index===leading.length){candidates.push(pairs);return;}
          for(let slot=0;slot<count;slot++)if(!used.has(slot))assign(index+1,new Set([...used,slot]),[...pairs,[leading[index],slot]]);
        };
        assign(0,new Set(),[]);
      }
      for(const assignment of candidates) {
        const pairs=[...assignment,...extras.map(n=>[n,assignment.reduce((best,pair)=>Math.abs(pair[0].midi-n.midi)<Math.abs(best[0].midi-n.midi)?pair:best)[1]])];
        const states=state.states.map(s=>({...s}));let cost=state.cost;
        for(const [note,slot] of pairs) {
          const prev=state.states[slot],gap=start-prev.end;
          if(gap<-EPS)cost+=500+(-gap)*20;
          cost+=Math.abs(note.midi-(prev.pitch??anchors[slot]))*(prev.pitch===null?.6:gap>4?.25:1);
          if(note.tieStop&&state.states.some(s=>s.tie&&s.pitch===note.midi&&Math.abs(start-s.end)<EPS))cost+=(prev.tie&&prev.pitch===note.midi&&Math.abs(gap)<EPS)?-40:200;
          if(sourceVoices.length>1&&sourceVoices.length<=count&&hint.get(note.sourceVoice)!==slot)cost+=18;
          if(mixedStems&&((note.stem==='up'&&slot!==0)||(note.stem==='down'&&slot!==count-1)))cost+=24;
          // A mild register preference resolves ties without prohibiting crossings.
          cost+=Math.abs(note.midi-anchors[slot])*.08;
          states[slot]={end:Math.max(prev.end,start+note.duration),pitch:note.midi,tie:!!note.tieStart};
        }
        next.push({cost,states,path:{previous:state.path,pairs}});
      }
    }
    next.sort((a,b)=>a.cost-b.cost);
    const seen=new Set();beam=[];
    for(const candidate of next) {
      const key=candidate.states.map(s=>`${s.pitch}:${s.end}:${s.tie}`).join('|');
      if(!seen.has(key)){seen.add(key);beam.push(candidate);if(beam.length===12)break;}
    }
  }
  const voices=Array.from({length:count},()=>[]),history=[];
  for(let path=beam[0]?.path;path;path=path.previous)history.push(path.pairs);
  for(const pairs of history.reverse())for(const [note,slot] of pairs)voices[slot].push({...note});
  crowded ||= voices.some(voice=>voice.some((note,i)=>i>0&&voice[i-1].start+voice[i-1].duration>note.start+EPS));
  return {voices,crowded};
}

export function inferredVoiceCount(notes) {
  const counts=new Map();
  for(const group of onsetGroups(notes))if(group.length>1)counts.set(group.length,(counts.get(group.length)||0)+1);
  // One decorative chord is insufficient evidence for automatic divisi.
  return Math.min(4,Math.max(1,...[...counts].filter(([,occurrences])=>occurrences>=2).map(([count])=>count)));
}
