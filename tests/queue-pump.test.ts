import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createStore } from "../src/lib/investigation/store";
import { fixtureState } from "./fixtures";
const modulePath = "../src/lib/investigation/queue-pump";
test("a recurring pump revisits an initially unexpired abandoned lease without another request", async () => {
  const api = await import(modulePath).catch(() => ({}));
  assert.equal(
    typeof api.createQueuePump,
    "function",
    "Autonomous queue pumping must exist",
  );
  const store = await createStore("memory://");
  let stop = () => {};
  try {
    const saved = await store.create(fixtureState);
    const job = await store.enqueue({
      investigationId: saved.id,
      inputRevision: 1,
      type: "baseline",
      input: { variants: ["G2D"] },
      inputHashes: ["test"],
    });
    await store.claim(Date.now(), 30);
    const errors: unknown[] = [];
    stop = api.createQueuePump(
      async () => {
        const claim = await store.claim();
        if (claim)
          await store.finish(claim.id, claim.leaseToken!, { recovered: true });
      },
      (error: unknown) => errors.push(error),
      10,
    );
    const deadline = Date.now() + 1000;
    while (
      (await store.getJob(job.id)).status !== "completed" &&
      Date.now() < deadline
    )
      await delay(10);
    assert.equal((await store.getJob(job.id)).status, "completed");
    assert.deepEqual(errors, []);
  } finally {
    stop();
    await store.close();
  }
});
