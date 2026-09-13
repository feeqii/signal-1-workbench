import { test } from "node:test";
import assert from "node:assert/strict";
import * as client from "../src/lib/investigation/client";
import {
  initialState,
  type CaseManifest,
  type SavedInvestigation,
} from "../src/lib/investigation/schema";
const state = initialState({
  id: "kras-k55",
  question: "Why?",
  reference: { sequenceHash: "a".repeat(64) },
  structures: [{ id: "a" }, { id: "b" }],
} as CaseManifest);
const saved: SavedInvestigation = {
  id: "one",
  revision: 1,
  createdAt: "",
  updatedAt: "",
  state,
};
test("saving retains edits made while a request is in flight and saves them against the next revision", async () => {
  assert.equal(typeof client.DraftSession, "function");
  const writes: { expectedRevision: number; state: typeof state }[] = [];
  let release: () => void = () => {};
  const session = new client.DraftSession(saved, async (_id, body) => {
    writes.push(body);
    if (writes.length === 1)
      await new Promise<void>((r) => {
        release = r;
      });
    return { ...saved, revision: body.expectedRevision + 1, state: body.state };
  });
  session.edit({ ...state, title: "First" });
  const pending = session.flush();
  session.edit({ ...state, title: "Second" });
  release();
  await pending;
  assert.equal(session.state.title, "Second");
  assert.equal(session.saved.revision, 3);
  assert.deepEqual(
    writes.map((w) => w.expectedRevision),
    [1, 2],
  );
});
test("failed save preserves the local draft and original revision for recovery", async () => {
  assert.equal(typeof client.DraftSession, "function");
  const session = new client.DraftSession(saved, async () => {
    throw new Error("Conflict");
  });
  session.edit({ ...state, title: "Unsaved" });
  await assert.rejects(session.flush(), /Conflict/);
  assert.equal(session.state.title, "Unsaved");
  assert.equal(session.saved.revision, 1);
  assert.equal(session.dirty, true);
});
test("successful saves adopt server-normalized state when no newer local edit exists", async () => {
  const session = new client.DraftSession(saved, async (_id, body) => ({
    ...saved,
    revision: 2,
    state: {
      ...body.state,
      comparisonJobId: null,
      title: body.state.title.trim(),
    },
  }));
  session.edit({ ...state, title: "  Draft  " });
  await session.flush();
  assert.equal(session.state.title, "Draft");
});

test('investigation transitions lock edits before saving and throughout asynchronous loading', async () => {
  assert.equal(typeof client.withDraftTransition, 'function');
  let release: (value: string) => void = () => {};
  const writes: string[] = [];
  const session = new client.DraftSession(saved, async (_id, body) => {
    writes.push(body.state.title);
    return { ...saved, revision: 2, state: body.state };
  });
  session.edit({ ...state, title: 'Keep this edit' });
  let installed = '';
  const loading = new Promise<string>(resolve => { release = resolve; });
  const transition = client.withDraftTransition(session, () => loading, value => { installed = value; });
  assert.equal(session.edit({ ...state, title: 'Race edit' }), false);
  await Promise.resolve();
  assert.equal(session.edit({ ...state, title: 'Late race edit' }), false);
  release('new investigation');
  await transition;
  assert.deepEqual(writes, ['Keep this edit']);
  assert.equal(installed, 'new investigation');
  assert.equal(session.dirty, false);
});

test('a failed investigation transition retains and unlocks the original draft', async () => {
  assert.equal(typeof client.withDraftTransition, 'function');
  const session = new client.DraftSession(saved, async () => { throw new Error('Conflict'); });
  session.edit({ ...state, title: 'Retained draft' });
  let installed = false;
  await assert.rejects(client.withDraftTransition(session, async () => 'new', () => { installed = true; }), /Conflict/);
  assert.equal(installed, false);
  assert.equal(session.state.title, 'Retained draft');
  assert.equal(session.edit({ ...state, title: 'Can edit again' }), true);
});

test('completed jobs remain deferred during a switch and attach after a failed load unlocks the original draft', async () => {
  assert.equal(typeof client.completedJobDisposition, 'function');
  const session = new client.DraftSession(saved);
  const job = { id: 'job-one', investigationId: saved.id, inputRevision: saved.revision, status: 'completed' };
  let rejectLoad: (error: Error) => void = () => {};
  const loading = new Promise<string>((_resolve, reject) => { rejectLoad = reject; });
  const transition = client.withDraftTransition(session, () => loading, () => {});
  assert.equal(client.completedJobDisposition(job, session), 'defer');
  rejectLoad(new Error('Destination failed'));
  await assert.rejects(transition, /Destination failed/);
  assert.equal(client.completedJobDisposition(job, session), 'attach');
  session.edit({ ...state, title: 'Unsaved scientific edit' });
  assert.equal(client.completedJobDisposition(job, session), 'stale');
});

test('a successful switch cannot consume the previous investigation completed job', async () => {
  assert.equal(typeof client.completedJobDisposition, 'function');
  const previous = new client.DraftSession(saved);
  const destination = new client.DraftSession({ ...saved, id: 'destination' });
  const job = { id: 'job-one', investigationId: saved.id, inputRevision: saved.revision, status: 'completed' };
  let current = previous;
  await client.withDraftTransition(previous, async () => destination, next => { current = next; });
  assert.equal(client.completedJobDisposition(job, current), 'defer');
  // Reopening its original investigation still permits processing the retained recovery ID.
  assert.equal(client.completedJobDisposition(job, new client.DraftSession(saved)), 'attach');
});
