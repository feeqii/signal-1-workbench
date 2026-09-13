import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureManifest,fixtureState} from './fixtures';
const modulePath='../src/lib/investigation/jobs';
test('calculations are bound to saved structures, validated variants and installed source hashes',async()=>{
  const api=await import(modulePath).catch(()=>({}));
  assert.equal(typeof api.validateJobInput,'function','Scientific job input validation must exist');
  const saved={id:'test',revision:1,createdAt:'date',updatedAt:'date',state:fixtureState};
  assert.deepEqual(api.validateJobInput('comparison',{leftId:'a',rightId:'b',positions:[4,1,2]},fixtureManifest,saved),{leftId:'a',rightId:'b',positions:[1,2,4]});
  assert.throws(()=>api.validateJobInput('comparison',{leftId:'a',rightId:'a',positions:[]},fixtureManifest,saved));
  assert.throws(()=>api.validateJobInput('comparison',{leftId:'a',rightId:'b',positions:[189]},fixtureManifest,saved));
  assert.throws(()=>api.validateJobInput('baseline',{variants:['A2D']},fixtureManifest,saved));
  assert.deepEqual(api.validateJobInput('baseline',{variants:['g2d']},fixtureManifest,saved),{variants:['G2D']});
});
