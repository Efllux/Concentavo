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
export function selectScorePart(xml, lanes, id) {
  const lane=lanes.find(l=>l.id===id);
  if(!lane)return xml;
  const doc=new DOMParser().parseFromString(xml,'application/xml'),parts=partsIn(doc),part=parts[lane.part??lanes.indexOf(lane)];
  if(!part)return xml;
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
export function publishedScoreData(xml, lanes) {
  const doc=new DOMParser().parseFromString(xml,'application/xml'),parts=partsIn(doc),published=structuredClone(lanes.filter(l=>l.published!==false));
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

export const publishedScoreXML=(xml,lanes)=>publishedScoreData(xml,lanes).xml;
