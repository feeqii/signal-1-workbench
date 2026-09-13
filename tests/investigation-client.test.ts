import {test} from 'node:test';import assert from 'node:assert/strict';
import * as client from '../src/lib/investigation/client';
import {initialState,type CaseManifest,type SavedInvestigation} from '../src/lib/investigation/schema';
const state=initialState({id:'kras-k55',question:'Why?',reference:{sequenceHash:'a'.repeat(64)},structures:[{id:'a'},{id:'b'}]} as CaseManifest);
const saved:SavedInvestigation={id:'one',revision:1,createdAt:'',updatedAt:'',state};
test('saving retains edits made while a request is in flight and saves them against the next revision',async()=>{
 assert.equal(typeof client.DraftSession,'function');
 const writes:{expectedRevision:number;state:typeof state}[]=[];
 let release:()=>void=()=>{};
 const session=new client.DraftSession(saved,async(_id,body)=>{writes.push(body);if(writes.length===1)await new Promise<void>(r=>{release=r});return {...saved,revision:body.expectedRevision+1,state:body.state};});
 session.edit({...state,title:'First'});const pending=session.flush();session.edit({...state,title:'Second'});release();await pending;
 assert.equal(session.state.title,'Second');assert.equal(session.saved.revision,3);assert.deepEqual(writes.map(w=>w.expectedRevision),[1,2]);
});
test('failed save preserves the local draft and original revision for recovery',async()=>{
 assert.equal(typeof client.DraftSession,'function');
 const session=new client.DraftSession(saved,async()=>{throw new Error('Conflict')});session.edit({...state,title:'Unsaved'});
 await assert.rejects(session.flush(),/Conflict/);assert.equal(session.state.title,'Unsaved');assert.equal(session.saved.revision,1);assert.equal(session.dirty,true);
});
test('successful saves adopt server-normalized state when no newer local edit exists',async()=>{
 const session=new client.DraftSession(saved,async(_id,body)=>({...saved,revision:2,state:{...body.state,comparisonJobId:null,title:body.state.title.trim()}}));
 session.edit({...state,title:'  Draft  '});await session.flush();assert.equal(session.state.title,'Draft');
});
