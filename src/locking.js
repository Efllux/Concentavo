const encoder=new TextEncoder(),decoder=new TextDecoder();
function base64(bytes){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
function bytes(text){return Uint8Array.from(atob(text),c=>c.charCodeAt(0));}
async function key(password,salt,usage){
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,[usage]);
}
export async function encryptPiece(piece,password){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(piece.id)},await key(password,salt,'encrypt'),encoder.encode(JSON.stringify(piece)));
  return {version:1,salt:base64(salt),iv:base64(iv),data:base64(new Uint8Array(encrypted))};
}
export async function decryptPiece(id,envelope,password){
  if(envelope.version!==1)throw Error('This locked piece needs a newer player.');
  let clear;
  try{clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv),additionalData:encoder.encode(id)},await key(password,bytes(envelope.salt),'decrypt'),bytes(envelope.data));}catch{throw Error('The password is incorrect, or this file is damaged.');}
  const piece=JSON.parse(decoder.decode(clear));if(piece.id!==id)throw Error('The locked piece does not match this page.');return piece;
}
export async function encryptRoom(room,password){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(`room:${room.id}`)},await key(password,salt,'encrypt'),encoder.encode(JSON.stringify(room)));
  return {version:1,salt:base64(salt),iv:base64(iv),data:base64(new Uint8Array(encrypted))};
}
export async function decryptRoom(id,envelope,password){
  if(envelope.version!==1)throw Error('This room needs a newer player.');
  let clear;
  try{clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv),additionalData:encoder.encode(`room:${id}`)},await key(password,bytes(envelope.salt),'decrypt'),bytes(envelope.data));}catch{throw Error('The password is incorrect, or this room is damaged.');}
  const room=JSON.parse(decoder.decode(clear));if(room.id!==id||!Array.isArray(room.tracks))throw Error('The protected room is invalid.');return room;
}
