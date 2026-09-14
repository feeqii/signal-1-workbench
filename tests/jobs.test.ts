import test from "node:test";
import assert from "node:assert/strict";
import { fixtureManifest, fixtureState } from "./fixtures";
const modulePath = "../src/lib/investigation/jobs";
test("calculations are bound to saved structures, validated variants and installed source hashes", async () => {
  const api = await import(modulePath).catch(() => ({}));
  assert.equal(
    typeof api.validateJobInput,
    "function",
    "Scientific job input validation must exist",
  );
  const saved = {
    id: "test",
    revision: 1,
    createdAt: "date",
    updatedAt: "date",
    state: fixtureState,
  };
  assert.deepEqual(
    api.validateJobInput(
      "comparison",
      { leftId: "a", rightId: "b", positions: [4, 1, 2] },
      fixtureManifest,
      saved,
    ),
    { leftId: "a", rightId: "b", positions: [1, 2, 4] },
  );
  assert.throws(() =>
    api.validateJobInput(
      "comparison",
      { leftId: "a", rightId: "a", positions: [] },
      fixtureManifest,
      saved,
    ),
  );
  assert.throws(() =>
    api.validateJobInput(
      "comparison",
      { leftId: "a", rightId: "b", positions: [189] },
      fixtureManifest,
      saved,
    ),
  );
  assert.throws(() =>
    api.validateJobInput(
      "baseline",
      { variants: ["A2D"] },
      fixtureManifest,
      saved,
    ),
  );
  assert.deepEqual(
    api.validateJobInput(
      "baseline",
      { variants: ["g2d"] },
      fixtureManifest,
      saved,
    ),
    { variants: ["G2D"] },
  );
});

test("changing a structure pair clears its incompatible active calculation before export", async () => {
  const modulePath = "../src/lib/investigation/links";
  const api = await import(modulePath).catch(() => ({}));
  assert.equal(
    typeof api.reconcileJobLinks,
    "function",
    "Saved comparison links must be reconciled",
  );
  const { createStore } = await import("../src/lib/investigation/store");
  const store = await createStore("memory://");
  try {
    const saved = await store.create(fixtureState);
    const job = await store.enqueue({
      investigationId: saved.id,
      inputRevision: 1,
      type: "comparison",
      input: { leftId: "a", rightId: "b", positions: [] },
      inputHashes: ["test"],
    });
    const linked = {
      ...fixtureState,
      comparisonJobId: job.id,
      view: { ...fixtureState.view, leftId: "b", rightId: "a" },
    };
    const checked = await api.reconcileJobLinks(linked, saved.id, store);
    assert.equal(checked.comparisonJobId, null);
    assert.equal((await store.getJob(job.id)).id, job.id);
    assert.equal(
      (
        await api.reconcileJobLinks(
          { ...fixtureState, comparisonJobId: job.id },
          saved.id,
          store,
        )
      ).comparisonJobId,
      job.id,
    );
  } finally {
    await store.close();
  }
});
