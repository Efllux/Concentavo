import {escapeXML as E} from './music.js';

// The leader library and the exported singer room use the same row anatomy and columns.
export function pieceListHTML(tracks,{viewer,selected,sortMode,missing,visibility,folderColor,tagColor,availabilityHTML,actionsHTML}){
  const tag=label=>`<span class="tag" style="--tag:${tagColor(label)}">${E(label)}</span>`;
  return `<div class="track-list piece-list"><div class="piece-list-head" aria-hidden="true"><span>Piece</span><span>Folder</span><span>Tags</span><span>Parts</span><span>${viewer?'My part':'Visibility'}</span><span></span></div>${tracks.map(t=>{
    const bars=t.score?.measures?.length||t.barCount||0,parts=(t.score?.lanes||[]).filter(l=>l.published!==false&&!l.removed).length||t.partCount||0;
    const composer=t.composer==='Concentavo · original exercise'?'Concentavo':t.composer;
    const state=visibility(t);
    return `<article class="track-row piece-list-row ${selected.has(t.id)?'selected':''}${missing(t)?' part-missing':''}" data-row="${t.id}" style="--folder:${folderColor(t.collection)}">
      <div class="track-main"><button class="track-title" data-open="${t.id}">${E(t.title)}</button><div class="track-meta"><span>${E(composer)}</span><span class="track-mobile-details">${composer?' · ':''}${bars} bars · ${parts} parts</span></div></div>
      <div class="track-taxonomy"><div class="track-folder">${t.collection?`<span class="folder-chip">${E(t.collection)}</span>`:''}</div><div class="track-tags">${t.tags.map(tag).join('')}<details class="piece-tags-more" hidden><summary class="tag" aria-label="More tags">+0</summary><div class="piece-tags-menu">${t.tags.map(tag).join('')}</div></details></div><div class="track-status-cell">${viewer?availabilityHTML(t):`<span class="track-status status-${state}">${state==='hidden'?'Hidden':state==='locked'?'Locked':'Visible'}</span>`}</div></div>
      <div class="track-count"><span>${parts} parts</span><small>${bars} bars</small></div><div class="row-actions">${actionsHTML(t,sortMode)}</div>
    </article>`;
  }).join('')}</div>`;
}

// Fit whole tags on one phone line. Overflow opens a keyboard-accessible menu containing every tag.
export function fitPieceTags(root){
  for(const row of root.querySelectorAll('.piece-list-row')){
    const host=row.querySelector('.track-tags'),more=host.querySelector('.piece-tags-more'),tags=[...host.children].filter(el=>el.matches('.tag'));
    tags.forEach(el=>el.hidden=false);more.hidden=true;
    if(!matchMedia('(max-width:700px)').matches)continue;
    const available=host.clientWidth,gap=parseFloat(getComputedStyle(host).gap)||0;
    let used=tags.reduce((n,el)=>n+el.getBoundingClientRect().width+gap,0),hidden=0;
    // Reserve the overflow trigger before hiding tags, so it never clips its last neighbour.
    for(let i=tags.length-1;i>=0&&used>available+1;i--){
      const width=tags[i].getBoundingClientRect().width;tags[i].hidden=true;hidden++;
      more.hidden=false;more.querySelector('summary').textContent='+'+hidden;
      used-=width+gap;
      if(used+more.getBoundingClientRect().width+gap<=available+1)break;
    }
    if(hidden){
      // If the first pass only just fit, include the trigger's width in the final calculation.
      for(let i=tags.length-hidden-1;i>=0&&used+more.getBoundingClientRect().width+gap>available+1;i--){used-=tags[i].getBoundingClientRect().width+gap;tags[i].hidden=true;hidden++;more.querySelector('summary').textContent='+'+hidden;}
    }
  }
}
