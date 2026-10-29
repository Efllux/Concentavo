const elements=(node,name)=>[...node.children].filter(n=>n.localName===name);

// Normalize only the in-memory representation. Keep source bytes separately;
// converting timewise grouping or XML namespaces never unfolds the notation.
export function normalizeDocument(input) {
  const root=input.documentElement;
  if(!['score-partwise','score-timewise'].includes(root.localName))throw Error('This file does not contain a MusicXML score.');
  const namespaced=!!root.namespaceURI||[...root.getElementsByTagName('*')].some(n=>!!n.prefix);
  if(root.localName==='score-partwise'&&!namespaced)return input;
  const doc=document.implementation.createDocument(null,'score-partwise');
  const clone=node=>{
    if(node.nodeType!==1)return doc.importNode(node,true);
    const result=doc.createElement(node.localName);
    for(const attr of node.attributes)if(attr.name!=='xmlns'&&attr.prefix!=='xmlns'){
      if(attr.namespaceURI)result.setAttributeNS(attr.namespaceURI,attr.name,attr.value);else result.setAttribute(attr.name,attr.value);
    }
    for(const child of node.childNodes)result.append(clone(child));
    return result;
  };
  for(const attr of root.attributes)if(attr.name!=='xmlns'&&attr.prefix!=='xmlns'){
    if(attr.namespaceURI)doc.documentElement.setAttributeNS(attr.namespaceURI,attr.name,attr.value);else doc.documentElement.setAttribute(attr.name,attr.value);
  }
  if(root.localName==='score-partwise'){
    for(const child of root.childNodes)doc.documentElement.append(clone(child));
    return doc;
  }
  for(const child of root.children)if(child.localName!=='measure')doc.documentElement.append(clone(child));
  const measures=elements(root,'measure'),ids=[...new Set([
    ...[...root.getElementsByTagNameNS('*','score-part')].map(p=>p.getAttribute('id')),
    ...measures.flatMap(m=>elements(m,'part').map(p=>p.getAttribute('id')))
  ])].filter(Boolean);
  for(const id of ids){
    const part=doc.createElement('part');part.setAttribute('id',id);
    for(const original of measures){
      const measure=doc.createElement('measure');for(const attr of original.attributes)measure.setAttribute(attr.name,attr.value);
      const body=elements(original,'part').find(p=>p.getAttribute('id')===id);
      if(body)for(const child of body.childNodes)measure.append(clone(child));
      part.append(measure);
    }
    doc.documentElement.append(part);
  }
  return doc;
}
