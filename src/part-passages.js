const EPS=.00001;
export function validPassages(lane,lanes,barCount){
  return (Array.isArray(lane.passages)?lane.passages:[]).slice(0,100).filter(p=>p&&Number.isInteger(p.first)&&Number.isInteger(p.last)&&p.first>=1&&p.last>=p.first&&p.last<=barCount&&[-24,-12,0,12,24].includes(p.transpose)&&lanes.some(l=>l.id===p.source&&l.id!==lane.id&&!l.generated));
}
const overlaps=(n,start,end)=>n.start<end-EPS&&n.start+n.duration>start+EPS;
function clip(note,start,end,lane,transpose=0){
  const at=Math.max(start,note.start),until=Math.min(end,note.start+note.duration),midi=note.midi+transpose;
  return until>at+EPS&&midi>=0&&midi<=127?{...note,lane,start:at,duration:until-at,midi}:null;
}
// Sources are the written parts, so reciprocal sharing is deterministic and does
// not recurse. Later passages take precedence over earlier overlapping ranges.
export function arrangedNotes(lane,score){
  if(!lane.passages?.length)return lane.notes||[];
  let result=[...(lane.notes||[])];
  for(const passage of validPassages(lane,score.lanes,score.measures.length)){
    const source=score.lanes.find(l=>l.id===passage.source);
    const selected=score.measures.slice(passage.first-1,passage.last).filter(m=>passage.mode!=='empty'||!result.some(n=>overlaps(n,m.start,m.start+m.length)));
    // Join contiguous bars before clipping; a held note must not retrigger at a barline.
    const ranges=[];
    for(const m of selected){const last=ranges.at(-1);if(last&&Math.abs(last[1]-m.start)<EPS)last[1]=m.start+m.length;else ranges.push([m.start,m.start+m.length]);}
    for(const [start,end] of ranges){
      result=result.flatMap(n=>!overlaps(n,start,end)?[n]:[clip(n,-Infinity,start,lane.id),clip(n,end,Infinity,lane.id)].filter(Boolean));
      result.push(...source.notes.map(n=>clip(n,start,end,lane.id,passage.transpose)).filter(Boolean));
    }
  }
  return result.sort((a,b)=>a.start-b.start||b.midi-a.midi);
}
export function arrangedScore(score){if(!score.lanes.some(l=>l.passages?.length))return score;return {...score,lanes:score.lanes.map(l=>({...l,notes:arrangedNotes(l,score)}))};}
