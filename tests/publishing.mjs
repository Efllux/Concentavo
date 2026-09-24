import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {publishProject}=require('../desktop/github-core.cjs');
const calls=[];
const api=async(method,path,data)=>{
  calls.push({method,path,data});
  if(path==='/user')return {login:'test-choir'};
  if(path==='/user/repos')return {name:'practice',default_branch:'main'};
  if(path.includes('/contents/'))throw Object.assign(Error('missing'),{status:404});
  if(path.includes('/git/ref/'))return {object:{sha:'head'}};
  if(path.endsWith('/git/commits/head'))return {tree:{sha:'base'}};
  if(path.endsWith('/git/trees'))return {sha:'tree'};
  if(path.endsWith('/git/commits'))return {sha:'commit'};
  if(path.endsWith('/pages')&&method==='GET')throw Object.assign(Error('missing'),{status:404});
  if(path.endsWith('/pages'))return {html_url:'https://test-choir.github.io/practice/',source:{branch:'main',path:'/'},build_type:'legacy'};
  return {private:false,default_branch:'main'};
};
const published=await publishProject({api,projectId:'room-1',name:'practice',html:'<!DOCTYPE html><html></html>'});
assert.equal(published.url,'https://test-choir.github.io/practice/');
assert.equal(calls.find(call=>call.method==='PATCH').data.force,false);
assert.equal(calls.find(call=>call.path.endsWith('/git/trees')).data.base_tree,'base');
const updateApi=(method,path,data)=>path.includes('/contents/')?Promise.resolve({content:Buffer.from(JSON.stringify({projectId:'room-1'})).toString('base64')}):api(method,path,data);
await assert.rejects(publishProject({api:updateApi,projectId:'room-1',name:'practice',html:'<!DOCTYPE html>',target:{owner:'test-choir',repo:'practice',projectId:'room-1',createdByChoirloom:true,commit:'older'}}),/updated from another device/);

const sharedFiles=new Map(),sharedCalls=[];let sharedExists=false,sharedHead='head',pending=[];
const missing=()=>Object.assign(Error('missing'),{status:404});
const sharedApi=async(method,path,data)=>{
  sharedCalls.push({method,path,data});
  if(path==='/user')return {login:'test-choir'};
  if(path==='/user/repos'&&method==='POST'){sharedExists=true;return {name:'all-rooms',default_branch:'main',private:false};}
  if(path==='/repos/test-choir/all-rooms'&&method==='GET'){if(!sharedExists)throw missing();return {name:'all-rooms',default_branch:'main',private:false};}
  if(path.includes('/contents/')&&method==='GET'){
    const file=path.split('/contents/')[1].split('?')[0],content=sharedFiles.get(file);
    if(content===undefined)throw missing();
    return {content:Buffer.from(content).toString('base64'),sha:`sha-${content.length}-${content.charCodeAt(0)}`};
  }
  if(path.includes('/git/ref/'))return {object:{sha:sharedHead}};
  if(path.includes('/git/commits/')&&method==='GET')return {tree:{sha:'base'}};
  if(path.endsWith('/git/trees')&&method==='POST'){pending=data.tree;return {sha:'tree'};}
  if(path.endsWith('/git/commits')&&method==='POST')return {sha:`next-${sharedCalls.length}`};
  if(path.includes('/git/refs/')&&method==='PATCH'){sharedHead=data.sha;for(const entry of pending)sharedFiles.set(entry.path,entry.content);return {};}
  if(path.endsWith('/pages')&&method==='GET')throw missing();
  if(path.endsWith('/pages')&&method==='POST')return {html_url:'https://test-choir.github.io/all-rooms/',source:{branch:'main',path:'/'},build_type:'legacy'};
  return {};
};
const first=await publishProject({api:sharedApi,projectId:'room-a',name:'all-rooms',layout:'shared',html:'<!DOCTYPE html><title>A</title>'});
assert.equal(first.url,'https://test-choir.github.io/all-rooms/rooms/room-a/');
assert.equal(first.layout,'shared');
assert.ok(sharedFiles.has('rooms/room-a/index.html'));
assert.ok(sharedFiles.has('.concentavo-rooms.json'));
const second=await publishProject({api:sharedApi,projectId:'room-b',name:'all-rooms',layout:'shared',html:'<!DOCTYPE html><title>B</title>'});
assert.equal(sharedCalls.filter(call=>call.method==='POST'&&call.path==='/user/repos').length,1);
assert.ok(sharedFiles.has('rooms/room-b/index.html'));
assert.ok(sharedFiles.has('rooms/room-a/index.html'));
await publishProject({api:sharedApi,projectId:'room-a',name:'all-rooms',layout:'shared',target:first,html:'<!DOCTYPE html><title>A again</title>'});
await assert.rejects(publishProject({api:sharedApi,projectId:'room-a',name:'all-rooms',layout:'shared',target:first,html:'<!DOCTYPE html><title>stale</title>'}),/updated from another device/);
console.log('PASS: separate and shared GitHub publishing, ownership and concurrent-update protection.');
