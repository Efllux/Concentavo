// Extract a display-only lane; the original score and audio timeline remain intact.
export function selectScorePart(xml, lanes, id) {
  const lane=lanes.find(l=>l.id===id);
  if(!lane)return xml;
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  const parts=[...doc.documentElement.children].filter(n=>n.localName==='part');
  const partIndex=lane.part??lanes.indexOf(lane),part=parts[partIndex];
  if(!part)return xml;
  const text=(n,name,fallback)=>n.querySelector(name)?.textContent||fallback;
  const partId=part.getAttribute('id');
  parts.filter(p=>p!==part).forEach(p=>p.remove());
  doc.querySelectorAll('score-part').forEach(p=>{if(p.getAttribute('id')!==partId)p.remove();else{const name=p.querySelector('part-name');if(name)name.textContent=lane.name;}});
  doc.querySelectorAll('part-group').forEach(p=>p.remove());
  if(lane.part!==undefined){
    for(const note of [...part.querySelectorAll('note')]){
      if(text(note,'staff','1')===String(lane.staff)&&text(note,'voice','1')===String(lane.voice)){
        note.querySelector('staff')?.remove();
      }else{
        const duration=note.querySelector('duration');
        if(duration&&!note.querySelector('chord')){const forward=doc.createElement('forward');forward.append(duration.cloneNode(true));note.replaceWith(forward);}else note.remove();
      }
    }
    part.querySelectorAll('staves').forEach(n=>n.textContent='1');
    part.querySelectorAll('clef,key,time,staff-details').forEach(n=>{const staff=n.getAttribute('number');if(staff&&staff!==String(lane.staff))n.remove();else n.removeAttribute('number');});
    part.querySelectorAll('direction').forEach(n=>{const staff=n.querySelector('staff');if(staff&&staff.textContent!==String(lane.staff))n.remove();else staff?.remove();});
    part.querySelectorAll('forward > staff').forEach(n=>n.remove());
  }
  return new XMLSerializer().serializeToString(doc);
}

// Create the notation shipped to singers while retaining every source lane in the authoring app.
export function publishedScoreXML(xml, lanes) {
  const doc=new DOMParser().parseFromString(xml,'application/xml'),parts=[...doc.documentElement.children].filter(n=>n.localName==='part');
  const text=(n,name,fallback)=>n.querySelector(name)?.textContent||fallback;
  parts.forEach((part,partIndex)=>{const source=lanes.filter(l=>!l.generated&&l.part===partIndex),kept=source.filter(l=>l.published!==false);if(source.length&&!kept.length){const id=part.getAttribute('id');part.remove();[...doc.querySelectorAll('score-part')].find(n=>n.getAttribute('id')===id)?.remove();return;}if(!source.length||kept.length===source.length)return;for(const note of [...part.querySelectorAll('note')]){const match=kept.some(l=>String(l.staff)===text(note,'staff','1')&&String(l.voice)===text(note,'voice','1'));if(match)continue;const duration=note.querySelector('duration');if(duration&&!note.querySelector('chord')){const forward=doc.createElement('forward');forward.append(duration.cloneNode(true));note.replaceWith(forward);}else note.remove();}});
  doc.querySelectorAll('part-group').forEach(n=>n.remove());
  return new XMLSerializer().serializeToString(doc);
}
