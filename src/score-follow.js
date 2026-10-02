// Interpolate musical time, rather than waiting for a note to reach the screen edge.
export function followPointAt(anchors,beat){
  if(!anchors.length)return null;
  let lo=0,hi=anchors.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(anchors[mid].beat<=beat)lo=mid+1;else hi=mid;}
  const a=anchors[Math.max(0,lo-1)],b=anchors[lo];
  if(!b||b.beat<=a.beat)return a;
  const progress=Math.min(1,Math.max(0,(beat-a.beat)/(b.beat-a.beat)));
  // At a system break, finish reading the current line before bringing in the next.
  if(a.system!==b.system)return {...a,y:a.y+(b.y-a.y)*Math.max(0,(progress-.65)/.35)};
  return {...a,x:a.x+(b.x-a.x)*progress,y:a.y+(b.y-a.y)*progress};
}

export function gradualScroll(current,target,elapsed,reducedMotion=false,maxSpeed=Infinity){
  if(reducedMotion)return target;
  if(elapsed<=0)return current;
  const amount=1-Math.exp(-Math.min(80,Math.max(0,elapsed))/260);
  const distance=(target-current)*amount,limit=maxSpeed*Math.min(25,Math.max(0,elapsed))/1000;
  return current+Math.max(-limit,Math.min(limit,distance));
}
