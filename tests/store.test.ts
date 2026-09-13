import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { InvestigationState } from '../src/lib/investigation/schema';
const sample: InvestigationState = {schemaVersion:1,caseId:'kras-k55',referenceHash:'a'.repeat(64),title:'First question',question:'How does binding change?',selectedPositions:[12],selectedVariant:null,view:{mode:'overlay',leftId:'a',rightId:'b',camera:null},findings:[],panel:[],comparisonJobId:null,baselineJobId:null};
const modulePath = '../src/lib/investigation/store';

test('persists revisions across close/reopen and rejects lost updates atomically', async () => {
  const api = await import(modulePath).catch(()=>({}));
  assert.equal(typeof api.createStore,'function','Durable investigation storage must be implemented');
  const path = await mkdtemp(join(tmpdir(),'signal-store-'));
  try {
    const store = await api.createStore(path);
    const saved = await store.create(sample);
    assert.equal(saved.revision,1);
    const results = await Promise.allSettled([store.save(saved.id,1,{...sample,title:'A'}),store.save(saved.id,1,{...sample,title:'B'})]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.filter(r=>r.status==='rejected').length,1);
    await store.close();
    const reopened = await api.createStore(path);
    const restored = await reopened.get(saved.id);
    assert.equal(restored.revision,2);
    assert.equal(restored.state.title,'A');
    assert.equal((await reopened.revisions(saved.id)).length,2);
    await reopened.close();
  } finally {await rm(path,{recursive:true,force:true});}
});

test('jobs are idempotent, recover expired leases and reject late completion after cancellation', async () => {
  const api = await import(modulePath).catch(()=>({}));
  assert.equal(typeof api.createStore,'function','Durable job storage must be implemented');
  const store = await api.createStore('memory://');
  try {
    const saved = await store.create(sample);
    const request = {investigationId:saved.id,inputRevision:1,type:'comparison',input:{leftId:'a',rightId:'b',positions:[1,2,3]},inputHashes:['x']};
    const first = await store.enqueue(request);
    assert.equal((await store.enqueue(request)).id,first.id);
    const claim = await store.claim(1000,10);
    assert.equal(claim.status,'running');
    const recovered = await store.claim(1020,10);
    assert.equal(recovered.id,first.id);
    assert.notEqual(recovered.leaseToken,claim.leaseToken);
    assert.equal(await store.finish(first.id,claim.leaseToken,{answer:'old'}),false);
    await store.cancel(first.id);
    assert.equal(await store.finish(first.id,recovered.leaseToken,{answer:'late'}),false);
    assert.equal((await store.getJob(first.id)).status,'cancelled');
    const retry = await store.enqueue(request);
    assert.equal(retry.id,first.id);
    assert.equal(retry.status,'queued');
    const active = await store.claim(2000,10);
    assert.equal(await store.finish(active.id,active.leaseToken,{answer:'valid'}),true);
    assert.equal(await store.finish(active.id,active.leaseToken,{answer:'duplicate'}),false);
    assert.deepEqual((await store.getJob(first.id)).result,{answer:'valid'});
  } finally {await store.close();}
});

test('restoring a bundle creates independent investigation and calculation identities atomically', async()=>{
  const api=await import(modulePath);
  const store=await api.createStore('memory://');
  try {
    assert.equal(typeof store.restore,'function','Atomic bundle restoration must exist');
    const originalId='00000000-0000-4000-8000-000000000001';
    const state={...sample,comparisonJobId:originalId};
    const restored=await store.restore(state,[{id:originalId,type:'comparison',input:{leftId:'a',rightId:'b',positions:[]},inputHashes:['a'],inputRevision:7,result:{rmsd:0.1}}]);
    assert.equal(restored.revision,1);
    assert.notEqual(restored.state.comparisonJobId,originalId);
    const job=await store.getJob(restored.state.comparisonJobId);
    assert.equal(job.investigationId,restored.id);
    assert.equal(job.status,'completed');
    assert.equal(job.inputRevision,1);
  } finally {await store.close();}
});
