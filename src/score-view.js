import { validPassages } from './part-passages.js';
const text=(n,name,fallback)=>n.querySelector(name)?.textContent||fallback;
const partsIn=doc=>[...doc.documentElement.children].filter(n=>n.localName==='part');
const laneMatcher=lane=>{
  const indices=lane.sourceNoteIndices&&new Set(lane.sourceNoteIndices),voices=(lane.sourceVoices||[lane.voice]).map(String);
  return (note,index)=>{
    if(indices&&note.querySelector('pitch')&&!note.querySelector('grace'))return indices.has(index);
    return text(note,'staff','1')===String(lane.staff)&&voices.includes(text(note,'voice','1'));
  };
};

// Filter complete onset groups, promoting a surviving chord tone to the leading
// note. Keeping <chord/> after deleting its anchor would move it to the wrong beat.
function filterNotes(doc,part,matches) {
  const indices=new Map([...part.querySelectorAll('note')].map((n,i)=>[n,i])),remap=new Map();
  for(const measure of [...part.children].filter(n=>n.localName==='measure')) {
    const groups=[];let current;
    for(const node of [...measure.children]) {
      if(node.localName!=='note'){current=null;continue;}
      if(node.querySelector('chord')&&current)current.push(node);
      else {current=[node];groups.push(current);}
    }
    for(const group of groups) {
      const originalDuration=Number(text(group[0],'duration',0)),kept=group.filter(n=>matches(n,indices.get(n)));
      if(!kept.length) {
        if(originalDuration){const forward=doc.createElement('forward'),duration=doc.createElement('duration');duration.textContent=String(originalDuration);forward.append(duration);group[0].before(forward);}
      } else {
        kept[0].querySelector('chord')?.remove();
        const remainder=originalDuration-Number(text(kept[0],'duration',0));
        if(remainder>0){const forward=doc.createElement('forward'),duration=doc.createElement('duration');duration.textContent=String(remainder);forward.append(duration);kept.at(-1).after(forward);}
      }
      group.filter(n=>!kept.includes(n)).forEach(n=>n.remove());
    }
  }
  [...part.querySelectorAll('note')].forEach((n,i)=>{if(indices.has(n))remap.set(indices.get(n),i);});
  return remap;
}

// Extract a display-only lane; the original score and audio timeline remain intact.
function extractScorePart(xml, lanes, id) {
  const lane=lanes.find(l=>l.id===id);
  if(!lane)return xml;
  const doc=new DOMParser().parseFromString(xml,'application/xml'),parts=partsIn(doc),part=parts[lane.part??lanes.indexOf(lane)];
  if(!part)return xml;
  shareLyrics(doc,lanes,lane);
  const partId=part.getAttribute('id');
  parts.filter(p=>p!==part).forEach(p=>p.remove());
  doc.querySelectorAll('score-part').forEach(p=>{if(p.getAttribute('id')!==partId)p.remove();else{const name=p.querySelector('part-name');if(name)name.textContent=lane.name;}});
  doc.querySelectorAll('part-group').forEach(p=>p.remove());
  if(lane.part!==undefined){
    filterNotes(doc,part,laneMatcher(lane));
    for(const note of part.querySelectorAll('note')){note.querySelector('staff')?.remove();const voice=note.querySelector('voice');if(voice)voice.textContent='1';}
    part.querySelectorAll('staves').forEach(n=>n.textContent='1');
    part.querySelectorAll('clef,key,time,staff-details').forEach(n=>{const staff=n.getAttribute('number');if(staff&&staff!==String(lane.staff))n.remove();else n.removeAttribute('number');});
    part.querySelectorAll('direction').forEach(n=>{const staff=n.querySelector('staff');if(staff&&staff.textContent!==String(lane.staff))n.remove();else staff?.remove();});
    part.querySelectorAll('forward > staff').forEach(n=>n.remove());
  }
  return new XMLSerializer().serializeToString(doc);
}

// Remap notation references along with the filtered XML, so single-part viewing
// still works after hiding a voice or removing an earlier source part on export.
function filterPublished(xml, lanes) {
  const doc=new DOMParser().parseFromString(xml,'application/xml'),parts=partsIn(doc),published=structuredClone(lanes.filter(l=>l.published!==false&&!l.removed));
  let newPart=0;
  parts.forEach((part,partIndex)=>{
    const source=lanes.filter(l=>!l.generated&&l.part===partIndex),kept=published.filter(l=>!l.generated&&l.part===partIndex);
    if(source.length&&!kept.length){const id=part.getAttribute('id');part.remove();[...doc.querySelectorAll('score-part')].find(n=>n.getAttribute('id')===id)?.remove();return;}
    const matchers=kept.map(laneMatcher);
    const remap=source.length&&kept.length!==source.length?filterNotes(doc,part,(note,index)=>matchers.some(match=>match(note,index))):null;
    for(const lane of kept){lane.part=newPart;if(remap&&lane.sourceNoteIndices)lane.sourceNoteIndices=lane.sourceNoteIndices.filter(i=>remap.has(i)).map(i=>remap.get(i));}
    newPart++;
  });
  doc.querySelectorAll('part-group').forEach(n=>n.remove());
  return {xml:new XMLSerializer().serializeToString(doc),lanes:published};
}

// MusicXML often writes common choir lyrics once. Match written onsets (not
// nearest words), retain all verse numbers/syllabic/extend markup, and never
// replace lyrics already supplied on a part.
function writtenNotes(doc){
  const refs=[];
  partsIn(doc).forEach((part,partIndex)=>{
    let divisions=1,transpose=0,index=0;
    [...part.children].filter(n=>n.localName==='measure').forEach((measure,bar)=>{
      let at=0,last=0;
      for(const node of measure.children){
        if(node.localName==='attributes'){
          divisions=Number(text(node,'divisions',divisions));
          const trans=node.querySelector('transpose');if(trans)transpose=Number(text(trans,'chromatic',0))+12*Number(text(trans,'octave-change',0));
        }else if(node.localName==='backup')at-=Number(text(node,'duration',0))/divisions;
        else if(node.localName==='forward')at+=Number(text(node,'duration',0))/divisions;
        else if(node.localName==='note'){
          const duration=Number(text(node,'duration',0))/divisions,start=node.querySelector('chord')?last:at;
          refs.push({part:partIndex,bar,start,duration,index:index++,staff:text(node,'staff','1'),node,divisions,transpose});
          if(!node.querySelector('chord')&&!node.querySelector('grace')){last=at;at+=duration;}
        }
      }
    });
  });return refs;
}
function shareLyrics(doc,lanes,onlyLane){
  const refs=writtenNotes(doc),pitched=refs.filter(r=>r.node.querySelector('pitch')&&!r.node.querySelector('grace'));
  const lyrics=r=>[...r.node.children].filter(n=>n.localName==='lyric');
  const original=new Map(pitched.map(r=>[r,lyrics(r).map(n=>n.cloneNode(true))]));
  const timeKey=r=>`${r.bar}:${r.start.toFixed(5)}`,staffKey=r=>`${r.part}:${r.staff}:${timeKey(r)}`;
  const staffLyrics=new Map(),visibleLyrics=new Set();
  for(const ref of pitched)if(original.get(ref)?.length){staffLyrics.set(staffKey(ref),original.get(ref));visibleLyrics.add(staffKey(ref));}
  const donorLyrics=r=>original.get(r)?.length?original.get(r):staffLyrics.get(staffKey(r));
  const laneRefs=new Map(lanes.filter(l=>!l.generated).map(l=>{const match=laneMatcher(l);return [l.id,pitched.filter(r=>r.part===l.part&&match(r.node,r.index))];}));
  const donorWords=new Map(lanes.map(l=>[l.id,new Map((laneRefs.get(l.id)||[]).filter(r=>donorLyrics(r)?.length).map(r=>[timeKey(r),donorLyrics(r)]))]));
  const ranked=lanes.filter(l=>!l.generated&&l.partType!=='instrument').sort((a,b)=>donorWords.get(b.id).size-donorWords.get(a.id).size);
  for(const lane of onlyLane?[onlyLane]:lanes.filter(l=>!l.generated&&!l.removed)){
    if(lane.lyricSource==='none')continue;
    const donors=lane.lyricSource&&lane.lyricSource!=='auto'?[lanes.find(l=>l.id===lane.lyricSource)].filter(Boolean):ranked;
    for(const ref of laneRefs.get(lane.id)||[]){
      if(lyrics(ref).length||!onlyLane&&visibleLyrics.has(staffKey(ref)))continue;
      // Chord tones on one written staff share their own lyrics first.
      let found=donorLyrics(ref);
      if(!found?.length&&lane.partType!=='instrument')for(const donor of donors){found=donorWords.get(donor.id)?.get(timeKey(ref));if(found?.length)break;}
      if(found?.length){for(const lyric of found)ref.node.append(lyric.cloneNode(true));visibleLyrics.add(staffKey(ref));}
    }
  }
}

function applyPassages(xml,lanes,id){
  const lane=lanes.find(l=>l.id===id),base=extractScorePart(xml,lanes,id);
  if(!lane?.passages?.length)return base;
  const doc=new DOMParser().parseFromString(base,'application/xml'),part=partsIn(doc)[0];if(!part)return base;
  const measures=[...part.children].filter(n=>n.localName==='measure'),sources=new Map(),origins=new Map();
  for(const [passageIndex,passage] of validPassages(lane,lanes,measures.length).entries()){
    if(!sources.has(passage.source))sources.set(passage.source,new DOMParser().parseFromString(extractScorePart(xml,lanes,passage.source),'application/xml'));
    const source=sources.get(passage.source),sourceMeasures=[...partsIn(source)[0].children].filter(n=>n.localName==='measure');
    const targetRefs=writtenNotes(doc),sourceRefs=writtenNotes(source);
    for(let bar=passage.first-1;bar<passage.last;bar++){
      const target=measures[bar],from=sourceMeasures[bar];if(!target||!from)continue;
      if(passage.mode==='empty'&&target.querySelector('note > pitch'))continue;
      origins.set(bar,passageIndex);
      const targetDiv=targetRefs.find(r=>r.bar===bar)?.divisions||Number(text(target,'attributes > divisions',targetRefs.filter(r=>r.bar<bar).at(-1)?.divisions||1));
      const sourceDiv=sourceRefs.find(r=>r.bar===bar)?.divisions||Number(text(from,'attributes > divisions',sourceRefs.filter(r=>r.bar<bar).at(-1)?.divisions||1));
      const targetTrans=targetRefs.find(r=>r.bar===bar)?.transpose||0,sourceTrans=sourceRefs.find(r=>r.bar===bar)?.transpose||0;
      [...target.children].filter(n=>['note','backup','forward'].includes(n.localName)).forEach(n=>n.remove());
      // Keep the target clef/key and directions; copy the source rhythm in target units.
      const ending=[...target.children].find(n=>n.localName==='barline'&&n.getAttribute('location')!=='left');
      for(const original of [...from.children].filter(n=>['note','backup','forward'].includes(n.localName))){
        const node=original.cloneNode(true);
        node.querySelectorAll('duration').forEach(n=>n.textContent=String(Number(n.textContent)*targetDiv/sourceDiv));
        const pitch=node.querySelector('pitch');
        if(pitch){const shift=passage.transpose+sourceTrans-targetTrans;if(shift%12===0)pitch.querySelector('octave').textContent=String(Number(text(pitch,'octave',4))+shift/12);else{const steps=['C','C','D','D','E','F','F','G','G','A','A','B'],midi=12*(Number(text(pitch,'octave',4))+1)+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[text(pitch,'step','C')])+Number(text(pitch,'alter',0))+shift,pc=((midi%12)+12)%12;pitch.querySelector('step').textContent=steps[pc];pitch.querySelector('octave').textContent=String(Math.floor(midi/12)-1);pitch.querySelector('alter')?.remove();if([1,3,6,8,10].includes(pc)){const alter=doc.createElement('alter');alter.textContent='1';pitch.querySelector('step').after(alter);}node.querySelector('accidental')?.remove();}node.querySelector('stem')?.remove();}
        if(ending)ending.before(node);else target.append(node);
      }
    }
  }
  pruneOrphanTies(doc,origins);
  return new XMLSerializer().serializeToString(doc);
}
function pruneOrphanTies(doc,origins){
  const refs=writtenNotes(doc),lengths=[];
  for(const r of refs)lengths[r.bar]=Math.max(lengths[r.bar]||0,r.start+r.duration);
  let beat=0;const starts=lengths.map(length=>{const start=beat;beat+=length||4;return start;}),onsets=new Map(),ends=new Map();
  const key=(midi,beat)=>`${midi}:${beat.toFixed(5)}`;
  for(const ref of refs){
    const pitch=ref.node.querySelector('pitch');if(!pitch)continue;
    ref.midi=12*(Number(text(pitch,'octave',4))+1)+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[text(pitch,'step','C')])+Number(text(pitch,'alter',0));ref.beat=starts[ref.bar]+ref.start;
    for(const [map,at] of [[onsets,ref.beat],[ends,ref.beat+ref.duration]]){const id=key(ref.midi,at);if(!map.has(id))map.set(id,[]);map.get(id).push(ref);}
  }
  for(const ref of refs){
    if(ref.midi===undefined||!ref.node.querySelector('tie'))continue;
    for(const type of ['start','stop']){
      const candidates=(type==='start'?onsets:ends).get(key(ref.midi,ref.beat+(type==='start'?ref.duration:0)))||[];
      const exists=candidates.some(other=>other!==ref&&(other.bar===ref.bar||origins.get(other.bar)===origins.get(ref.bar))&&other.node.querySelector(`tie[type="${type==='start'?'stop':'start'}"]`));
      if(!exists)ref.node.querySelectorAll(`tie[type="${type}"],tied[type="${type}"]`).forEach(n=>n.remove());
    }
  }
}

export function selectScorePart(xml,lanes,id){return applyPassages(xml,lanes,id);}
export function practiceScoreData(xml,lanes){
  if(!lanes.some(l=>!l.removed&&l.passages?.length)){
    const doc=new DOMParser().parseFromString(xml,'application/xml');shareLyrics(doc,lanes);
    const filtered=filterPublished(new XMLSerializer().serializeToString(doc),lanes.map(l=>({...l,published:!l.removed})));
    filtered.lanes.forEach(l=>l.published=lanes.find(o=>o.id===l.id)?.published!==false);return filtered;
  }
  const doc=new DOMParser().parseFromString(xml,'application/xml');let list=doc.querySelector('part-list');if(!list){list=doc.createElement('part-list');doc.documentElement.insertBefore(list,partsIn(doc)[0]||null);}
  partsIn(doc).forEach(n=>n.remove());list.replaceChildren();
  const active=structuredClone(lanes.filter(l=>!l.removed));let index=0;
  for(const lane of active.filter(l=>!l.generated)){
    const single=new DOMParser().parseFromString(applyPassages(xml,lanes,lane.id),'application/xml'),part=partsIn(single)[0];if(!part)continue;
    const id='arranged-'+index,definition=single.querySelector('score-part')||doc.createElement('score-part');if(!definition.querySelector('part-name')){const name=doc.createElement('part-name');name.textContent=lane.name;definition.append(name);}part.setAttribute('id',id);definition.setAttribute('id',id);list.append(doc.importNode(definition,true));doc.documentElement.append(doc.importNode(part,true));
    lane.part=index++;lane.staff='1';lane.voice='1';delete lane.sourceNoteIndices;delete lane.sourceVoices;delete lane.passages;
  }
  return {xml:new XMLSerializer().serializeToString(doc),lanes:active};
}
export function publishedScoreData(xml,lanes){
  const prepared=practiceScoreData(xml,lanes);
  return filterPublished(prepared.xml,prepared.lanes);
}
export const publishedScoreXML=(xml,lanes)=>publishedScoreData(xml,lanes).xml;
