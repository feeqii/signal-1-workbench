import { createStore } from "../../src/lib/investigation/store";
import { fixtureState } from "../fixtures";

async function main() {
  const store = await createStore(process.argv[2]);
  if (process.argv[3] === "create") {
    const saved = await store.create(fixtureState);
    await store.save(saved.id, 1, {
      ...fixtureState,
      title: "Saved before process death",
    });
    await store.enqueue({
      investigationId: saved.id,
      inputRevision: 2,
      type: "comparison",
      input: { leftId: "a", rightId: "b", positions: [] },
      inputHashes: ["a"],
    });
    const job = await store.claim(Date.now(), 100);
    process.send!({ saved: await store.get(saved.id), job });
    setInterval(() => {}, 1000);
  } else {
    const saved = (await store.list())[0];
    const job = await store.claim(Date.now() + 1000);
    const revisions = await store.revisions(saved.id);
    await store.close();
    process.send!({ saved, job, revisionCount: revisions.length });
    process.disconnect!();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
