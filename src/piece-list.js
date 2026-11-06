import {escapeXML as E} from './music.js';

// The leader library and the exported singer room use the same row anatomy and columns.
export function pieceListHTML(tracks,{viewer,selected,sortMode,missing,visibility,folderColor,tagColor,availabilityHTML,actionsHTML,partChosen=false}){
  const tag=label=>`<span class="tag" style="--tag:${tagColor(label)}">${E(label)}</span>`;
  return `<div class="track-list piece-list"><div class="piece-list-head" aria-hidden="true"><span>Piece</span><span>Folder</span><span>Tags</span><span>Parts</span><span>${viewer?(partChosen?'My part':''):'Visibility'}</span><span></span></div>${tracks.map(t=>{
    const bars=t.score?.measures?.length||t.barCount||0,parts=(t.score?.lanes||[]).filter(l=>l.published!==false&&!l.removed).length||t.partCount||0;
    const composer=t.composer==='Concentavo · original exercise'?'Concentavo':t.composer;
    const state=visibility(t);
    if(viewer)return `<article class="track-row piece-list-row singer-song${t.title.length>55?' long-song-title':''}${missing(t)?' part-missing':''}" data-row="${t.id}" style="--folder:${folderColor(t.collection)}">
      <div class="track-main"><button class="track-title" data-open="${t.id}">${E(t.title)}</button><div class="track-meta">${E(composer)}</div></div>
      ${availabilityHTML(t)||missing(t)?`<div class="singer-song-availability">${availabilityHTML(t)}${missing(t)?`<button type="button" class="listen-choir" data-open="${t.id}">Listen to the whole choir</button>`:''}</div>`:''}
      <details class="singer-song-details"><summary aria-label="Song details" title="Song details"><span class="details-word">Details</span><svg class="info-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.25"/><path d="M12 10.5v6"/><circle cx="12" cy="7.4" r=".6"/></svg></summary><div class="song-details-body"><strong>${E(t.title)}</strong><p>${bars} bars · ${parts} parts</p><div class="track-folder">${E(t.collection)}</div><div class="track-tags">${t.tags.map(tag).join('')}<details class="piece-tags-more" hidden><summary>More tags</summary><div>${t.tags.map(tag).join('')}</div></details></div></div></details>
      <div class="row-actions">${actionsHTML(t,sortMode)}</div></article>`;

    return `<article class="track-row piece-list-row ${selected.has(t.id)?'selected':''}${missing(t)?' part-missing':''}" data-row="${t.id}" style="--folder:${folderColor(t.collection)}">
      <div class="track-main"><button class="track-title" data-open="${t.id}">${E(t.title)}</button><div class="track-meta"><span>${E(composer)}</span><span class="track-mobile-details">${composer?' · ':''}${bars} bars · ${parts} parts</span></div></div>
      <div class="track-taxonomy"><div class="track-folder">${t.collection?`<span class="folder-chip">${E(t.collection)}</span>`:''}</div><div class="track-tags">${t.tags.map(tag).join('')}<details class="piece-tags-more" hidden><summary class="tag" aria-label="More tags">+0</summary><div class="piece-tags-menu">${t.tags.map(tag).join('')}</div></details></div><div class="track-status-cell">${viewer?availabilityHTML(t):(state==='visible'?'<span class="track-status status-visible visually-hidden">Visible</span>':`<span class="track-status status-${state}">${state==='hidden'?'Hidden':'Locked'}</span>`)}</div></div>
      <div class="track-count"><span>${parts} parts</span><small>${bars} bars</small></div><div class="row-actions">${actionsHTML(t,sortMode)}</div>
    </article>`;
  }).join('')}</div>`;
}

// Desktop tables show every tag, wrapping when needed. Phone overflow opens a keyboard-accessible menu containing every tag.
export function fitPieceTags(root){
  for(const row of root.querySelectorAll('.piece-list-row')){
    const host=row.querySelector('.track-tags'),more=host.querySelector('.piece-tags-more'),tags=[...host.children].filter(el=>el.matches('.tag'));
    tags.forEach(el=>el.hidden=false);more.hidden=true;
    if(row.classList.contains('singer-song')||matchMedia('(min-width:701px)').matches)continue;
    const available=host.clientWidth,gap=parseFloat(getComputedStyle(host).gap)||0;
    let used=tags.reduce((n,el)=>n+el.getBoundingClientRect().width+gap,0),hidden=0;
    // Ensemble labels (SATB, SSA…) repeat what the part counts already say: they go into the overflow before practice tags such as accompaniment.
    const ensemble=el=>/^[SATB]{2,6}$/i.test(el.textContent.trim()),order=[...tags.filter(el=>!ensemble(el)),...tags.filter(ensemble)];
    // Reserve the overflow trigger before hiding tags, so it never clips its last neighbour.
    for(let i=order.length-1;i>=0&&used>available+1;i--){
      const width=order[i].getBoundingClientRect().width;order[i].hidden=true;hidden++;
      more.hidden=false;more.querySelector('summary').textContent='+'+hidden;
      used-=width+gap;
      if(used+more.getBoundingClientRect().width+gap<=available+1)break;
    }
    if(hidden){
      // If the first pass only just fit, include the trigger's width in the final calculation.
      for(let i=order.length-hidden-1;i>=0&&used+more.getBoundingClientRect().width+gap>available+1;i--){used-=order[i].getBoundingClientRect().width+gap;order[i].hidden=true;hidden++;more.querySelector('summary').textContent='+'+hidden;}
    }
  }
}
