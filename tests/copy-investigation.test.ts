import test from "node:test";
import assert from "node:assert/strict";
import { fixtureManifest, fixtureState } from "./fixtures";
import { createStore } from "../src/lib/investigation/store";

test("copying research clones its completed calculations so the new record remains editable", async () => {
  const path = "../src/lib/investigation/links";
  const api = await import(path);
  assert.equal(typeof api.createWithLocalResults, "function");
  const store = await createStore("memory://");
  try {
    const source = await store.create(fixtureState);
    const job = await store.enqueue({
      investigationId: source.id,
      inputRevision: 1,
      type: "comparison",
      input: { leftId: "a", rightId: "b", positions: [] },
      inputHashes: [],
    });
    const state = { ...fixtureState, comparisonJobId: job.id };
    await assert.rejects(
      api.createWithLocalResults(state, fixtureManifest, store),
      /completed/,
    );
    const claimed = await store.claim();
    await store.finish(job.id, claimed!.leaseToken!, { rmsd: 1 });
    const copy = await api.createWithLocalResults(
      state,
      fixtureManifest,
      store,
    );
    assert.notEqual(copy.id, source.id);
    assert.notEqual(copy.state.comparisonJobId, job.id);
    const copiedJob = await store.getJob(copy.state.comparisonJobId);
    assert.equal(copiedJob.investigationId, copy.id);
    assert.deepEqual(copiedJob.result, { rmsd: 1 });
    const edited = await api.reconcileJobLinks(
      { ...copy.state, title: "Edited copy" },
      copy.id,
      store,
    );
    assert.equal((await store.save(copy.id, 1, edited)).revision, 2);
    await assert.rejects(
      api.createWithLocalResults(
        { ...state, view: { ...state.view, leftId: "b", rightId: "a" } },
        fixtureManifest,
        store,
      ),
      /pair/,
    );
    await assert.rejects(
      api.createWithLocalResults(
        { ...state, baselineJobId: job.id },
        fixtureManifest,
        store,
      ),
      /type/,
    );
    await assert.rejects(
      api.createWithLocalResults(
        state,
        {
          ...fixtureManifest,
          assets: [
            {
              path: "changed",
              sha256: "x",
              bytes: 1,
              sourceUrl: "test",
              license: "test",
            },
          ],
        },
        store,
      ),
      /case/,
    );
  } finally {
    await store.close();
  }
});
