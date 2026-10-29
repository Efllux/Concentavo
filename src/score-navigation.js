const EPS=.00001;
const length=m=>m.length??m.meter??4;
const commands=new Set(['dacapo','dalsegno','tocoda','fine']);
const times=value=>String(value||'').split(/[, ]+/).map(Number).filter(n=>Number.isInteger(n)&&n>0);

const label=value=>({i:'1',ii:'2',iii:'3',iv:'4',v:'5'}[value]||value||'@notation');
export function notationNavigation(el,offset) {
  const all=name=>[...el.getElementsByTagNameNS('*',name)];
  const raw=all('words').map(n=>n.textContent).join(' ');
  const text=raw.normalize('NFKC').replace(/[.\u2024]/g,'').replace(/[\uE047\uE048\u{1D10B}\u{1D10C}]/gu,'').replace(/\s+/g,' ').trim().toLowerCase();
  const ref=text.match(/\b(?:m|mm|measure|bar|maat)\s*(?:no\s*)?(\d+[a-z]?)/i)?.[1];
  const ordinal=text.match(/\b(\d+)(?:st|nd|rd|th)?\s+(?:time|pass)\b/)?.[1]||(/\bsecond\s+time\b/.test(text)?'2':/\bthird\s+time\b/.test(text)?'3':'');
  const make=(type,value='@notation')=>({type,value,offset,timeOnly:ordinal,source:'notation',...(ref?{targetBar:ref}:{})});
  const ds=text.match(/\b(?:d\s*s|dal\s+segno)(?:\s+(\d+|i{1,3}|iv|v))?\b/);
  if(ds)return [make('dalsegno',label(ds[1]))];
  if(/\b(?:d\s*c|da\s+capo)\b/.test(text))return [make('dacapo','yes')];
  if(/\b(?:to|al|alla)\s+coda\b/.test(text))return [make('tocoda')];
  const named=text.match(/^(segno|coda|fine)(?:\s+(\d+|i{1,3}|iv|v))?$/);
  if(named)return [make(named[1],named[1]==='fine'?'yes':label(named[2]))];
  const result=[];
  if(all('segno').length||/[\uE047\u{1D10B}]/u.test(raw))result.push(make('segno'));
  if(all('coda').length||/[\uE048\u{1D10C}]/u.test(raw))result.push(make('coda-symbol'));
  return result;
}

// Playback metadata is inferred only when the exporter omitted sound markers.
// Explicit bar references resolve missing symbols; ambiguous targets are left
// unresolved with a warning rather than selecting an arbitrary destination.
export function resolveNavigation(measures) {
  const warnings=new Set();let inferred=false;
  measures.forEach(m=>{
    const written=m.navigation||[],sound=written.filter(n=>n.source!=='notation');
    m.navigation=written.filter(n=>n.source!=='notation'||!sound.some(s=>Math.abs(s.offset-n.offset)<EPS&&(s.type===n.type||n.type==='coda-symbol'&&['coda','tocoda'].includes(s.type))));
    for(const n of m.navigation){
      if(n.type==='coda-symbol')n.type=n.offset>EPS?'tocoda':'coda';
      if(n.source==='notation')inferred=true;
    }
  });
  const entries=()=>measures.flatMap((m,i)=>(m.navigation||[]).map(n=>({n,i})));
  for(const {n,i} of entries().filter(x=>['dalsegno','tocoda'].includes(x.n.type))){
    const type=n.type==='dalsegno'?'segno':'coda';
    let candidates=entries().filter(x=>x.n.type===type);
    const exact=candidates.filter(x=>x.n.value===n.value);
    if(n.source!=='notation'&&exact.length)continue;
    if(n.targetBar){
      const destinations=measures.map((m,i)=>({m,i})).filter(x=>String(x.m.number).toLowerCase()===n.targetBar.toLowerCase());
      if(destinations.length===1){
        const target=destinations[0];
        const value=`@bar:${type}:${n.targetBar}`;
        target.m.navigation.push({type,value,offset:0,source:'notation'});n.value=value;
        inferred=true;continue;
      }
      warnings.add('A written jump refers to an ambiguous or missing bar number. Review the playback route.');n.value='@unresolved';continue;
    }
    if(n.value!=='@notation'&&exact.length)candidates=exact;
    else if(type==='coda')candidates=candidates.filter(x=>x.i>i||x.i===i&&x.n.offset>n.offset);
    else candidates=candidates.filter(x=>x.i<i||x.i===i&&x.n.offset<n.offset);
    const unique=[...new Map(candidates.map(x=>[`${x.i}:${x.n.offset}`,x])).values()];
    if(unique.length===1){
      const target=unique[0];
      // Preserve an encoded label when pairing it with a visual-only target.
      if(n.source!=='notation')target.n.value=n.value;
      else n.value=target.n.value;
    }else if(unique.length>1){warnings.add(`A written ${type} jump has several possible destinations. Review the playback route.`);n.value='@unresolved';}
  }
  for(const m of measures)m.navigation=(m.navigation||[]).filter((n,i,a)=>!a.slice(0,i).some(o=>o.type===n.type&&o.value===n.value&&Math.abs(o.offset-n.offset)<EPS&&o.timeOnly===n.timeOnly));
  if(inferred)warnings.add('Repeat navigation was interpreted from written text or symbols. Review the playback route.');
  return [...warnings];
}

function targets(measures) {
  const found=new Map(),ambiguous=new Set();
  measures.forEach((m,i)=>{
    for(const n of m.navigation||[])if(n.type==='segno'||n.type==='coda') {
      const offset=Math.max(0,Math.min(length(m),n.offset||0));
      const key=`${n.type}:${n.value}`,target=offset>=length(m)-EPS?{measure:i+1,from:0}:{measure:i,from:offset},previous=found.get(key);
      if(previous&&(previous.measure!==target.measure||Math.abs(previous.from-target.from)>EPS))ambiguous.add(key);
      found.set(key,target);
    }
  });
  for(const key of ambiguous)found.delete(key);
  return found;
}

export function navigationWarnings(measures) {
  const found=targets(measures),warnings=new Set();
  for(const m of measures)for(const n of m.navigation||[]) {
    const type=n.type==='dalsegno'?'segno':n.type==='tocoda'?'coda':null;
    if(type&&!found.has(`${type}:${n.value}`))warnings.add(`A ${type} jump has no unique matching destination and is not played. Review the playback route.`);
  }
  if(playbackRoute(measures).truncated)warnings.add('The repeat route exceeds the playback limit and was truncated. Review repeats and jumps.');
  return [...warnings];
}

// Keep written bar numbers for the cursor while unfolding the playback route.
// Offsets also permit a return, coda or Fine in the middle of a measure.
export function playbackRoute(measures,repeats=true) {
  if(!repeats)return measures.map((m,i)=>({measure:i,from:0,to:length(m)}));
  const route=[],found=targets(measures),visits=new Map(),measureVisits=new Map(),used=new Set(),passes=new Map(),seenSections=new Set();
  const sections=[],stack=[];let implicit=0;
  measures.forEach((m,i)=>{
    if(m.forward)stack.push(i);
    if(m.backward){const start=stack.pop()??implicit;sections.push({start,end:i,total:m.backward,afterJump:!!m.repeatAfterJump});if(!stack.length)implicit=i+1;}
  });
  const owner=new Map();let endingOwner=null,previousAllowed='';
  measures.forEach((m,i)=>{
    const key=(m.allowed||[]).join(',');
    if(key&&key!==previousAllowed){
      const prior=m.allowed.includes(1)?null:sections.filter(r=>r.end===i-1).sort((a,b)=>b.start-a.start)[0];
      endingOwner=prior||sections.filter(r=>r.start<=i&&r.end>=i).sort((a,b)=>b.start-a.start)[0];
    }
    if(key&&endingOwner)owner.set(i,endingOwner);if(!key)endingOwner=null;previousAllowed=key;
  });
  let i=0,from=0,steps=0,returned=false,replaying=false;
  const limit=Math.max(10000,measures.length*64);
  while(i<measures.length&&steps++<limit) {
    for(const r of sections.filter(r=>r.start===i))if(!passes.has(r)){
      passes.set(r,replaying&&seenSections.has(r)&&!r.afterJump?Math.max(2,r.total):1);seenSections.add(r);
    }
    const visit=(measureVisits.get(i)||0)+1;measureVisits.set(i,visit);
    const m=measures[i],end=length(m),section=owner.get(i),pass=section?(passes.get(section)??(replaying&&seenSections.has(section)?Math.max(2,section.total):1)):visit,played=!m.allowed?.length||m.allowed.includes(pass);
    let destination=null,stop=false,to=end;
    if(played)for(const [ni,n] of [...(m.navigation||[])].map((n,ni)=>[ni,n]).sort((a,b)=>a[1].offset-b[1].offset)) {
      if(!commands.has(n.type)||n.offset<from-EPS)continue;
      const key=`${i}:${ni}`,visit=(visits.get(key)||0)+1;
      visits.set(key,visit);
      if(used.has(key))continue;
      const only=times(n.timeOnly),enabled=only.length?only.includes(visit):n.type==='tocoda'?visit>=2||returned:n.type==='fine'?returned:visit===1;
      if(!enabled)continue;
      if(n.type==='fine')stop=true;
      else if(n.type==='dacapo'&&n.value==='yes')destination={measure:0,from:0};
      else if(n.type==='dalsegno')destination=found.get(`segno:${n.value}`);
      else if(n.type==='tocoda')destination=found.get(`coda:${n.value}`);
      if(stop||destination){
        to=Math.max(from,Math.min(end,n.offset));used.add(key);
        if(n.type==='dacapo'||n.type==='dalsegno'){returned=true;replaying=true;passes.clear();}
        if(n.type==='tocoda'){replaying=false;passes.clear();}
        break;
      }
    }
    if(played&&to>from+EPS)route.push({measure:i,from,to});
    if(stop)break;
    if(destination){i=destination.measure;from=destination.from;continue;}
    // Repeats normally do not play again following D.C./D.S.; MusicXML can
    // explicitly request them with repeat's after-jump attribute.
    const closing=sections.find(r=>r.end===i);
    if(closing) {
      const count=passes.get(closing)??(replaying&&seenSections.has(closing)&&!closing.afterJump?Math.max(2,closing.total):1);seenSections.add(closing);
      if(count<closing.total){
        passes.set(closing,count+1);
        for(const inner of sections)if(inner!==closing&&inner.start>=closing.start&&inner.end<=closing.end)passes.delete(inner);
        i=closing.start;from=0;continue;
      }
    }
    i++;from=0;
  }
  if(i<measures.length&&steps>=limit)route.truncated=true;
  return route;
}
