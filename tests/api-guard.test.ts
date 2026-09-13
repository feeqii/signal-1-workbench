import test from 'node:test';
import assert from 'node:assert/strict';
const modulePath='../src/lib/investigation/api';
test('local API rejects cross-origin requests, remote host names and oversized bodies',async()=>{
  const api=await import(modulePath).catch(()=>({}));
  assert.equal(typeof api.readJson,'function','Bounded local API input must be implemented');
  const make=(headers:Record<string,string>,body='{}')=>new Request('http://localhost:3000/api/investigations',{method:'POST',headers:{host:'localhost:3000','content-type':'application/json',...headers},body});
  assert.deepEqual(await api.readJson(make({origin:'http://localhost:3000'}),10),{});
  await assert.rejects(()=>api.readJson(make({origin:'https://elsewhere.example'}),10));
  await assert.rejects(()=>api.readJson(make({host:'evil.example:3000'}),10));
  await assert.rejects(()=>api.readJson(make({},'{"long":"xxxxxxxxxxxx"}'),10));
  await assert.rejects(()=>api.readJson(make({'sec-fetch-site':'cross-site'}),10));
});

test('revision conflicts retain HTTP status across independently bundled server modules',async()=>{
  const api=await import(modulePath);
  class OtherBundleStoreError extends Error {name='Signal1StoreError';status=409;}
  assert.equal(api.apiError(new OtherBundleStoreError('Concurrent revision')).status,409);
});
