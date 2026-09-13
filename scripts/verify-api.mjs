import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

const base = new URL(process.env.SIGNAL1_URL || "http://127.0.0.1:3000");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))
  throw new Error("Verification requires a local app.");
async function request(path, body, method = body ? "POST" : "GET") {
  const response = await fetch(new URL(path, base), {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
const deadline = Date.now() + 60_000;
while (true) {
  try {
    const ready = await request("/api/case");
    assert.equal(ready.status, 200, JSON.stringify(ready.data));
    assert.equal(ready.data.observations.length, 27813);
    break;
  } catch (error) {
    if (Date.now() > deadline) throw error;
    await delay(500);
  }
}
const created = await request("/api/investigations", {});
assert.equal(created.status, 201, JSON.stringify(created.data));
const saved = created.data;
const state = {
  ...saved.state,
  title: "Verification · KRAS investigation",
  selectedVariant: "G12D",
  selectedPositions: [12],
  findings: [
    {
      id: "finding-verification",
      title: "Binding and abundance question",
      claim: "Test whether the two measured readouts differ for this variant.",
      kind: "hypothesis",
      evidenceVariants: ["G12D"],
      positions: [12],
      contradictoryEvidence:
        "A paired measurement alone does not establish a causal mechanism.",
    },
  ],
  panel: [
    {
      variant: "G12D",
      role: "candidate",
      rationale: "Investigate the measured variant.",
      expectedObservation: "Compare abundance and binding independently.",
      replicates: 2,
    },
    {
      variant: "WT",
      role: "negative-control",
      rationale: "Reference control.",
      expectedObservation: "Reference assay behavior.",
      replicates: 3,
    },
  ],
};
const updated = await request(
  `/api/investigations/${saved.id}`,
  { expectedRevision: 1, state },
  "PUT",
);
assert.equal(updated.status, 200, JSON.stringify(updated.data));
assert.equal(
  (
    await request(
      `/api/investigations/${saved.id}`,
      { expectedRevision: 1, state },
      "PUT",
    )
  ).status,
  409,
);
const jobRequest = {
  investigationId: saved.id,
  inputRevision: 2,
  type: "comparison",
  input: {
    leftId: state.view.leftId,
    rightId: state.view.rightId,
    positions: [],
  },
};
const queued = await request("/api/jobs", jobRequest);
assert.equal(queued.status, 202, JSON.stringify(queued.data));
assert.equal((await request("/api/jobs", jobRequest)).data.id, queued.data.id);
let job = queued.data;
const jobDeadline = Date.now() + 60_000;
while (job.status !== "completed") {
  if (Date.now() > jobDeadline || job.status === "failed")
    throw new Error(JSON.stringify(job));
  await delay(200);
  job = (await request(`/api/jobs/${job.id}`)).data;
}
assert.equal(job.result.count, 164);
assert.ok(Math.abs(job.result.rmsd - 1.5076231048929027) < 1e-8);
const finalized = await request(
  `/api/investigations/${saved.id}`,
  { expectedRevision: 2, state: { ...state, comparisonJobId: job.id } },
  "PUT",
);
assert.equal(finalized.status, 200);
const exported = await request(`/api/investigations/${saved.id}/export`);
assert.equal(exported.status, 200);
const copied = await request("/api/investigations", {
  state: finalized.data.state,
});
assert.equal(copied.status, 201, JSON.stringify(copied.data));
assert.notEqual(copied.data.state.comparisonJobId, job.id);
const copiedJob = (
  await request(`/api/jobs/${copied.data.state.comparisonJobId}`)
).data;
assert.equal(copiedJob.investigationId, copied.data.id);
assert.deepEqual(copiedJob.result, job.result);
assert.equal(
  (
    await request(
      `/api/investigations/${copied.data.id}`,
      {
        expectedRevision: 1,
        state: { ...copied.data.state, title: "Verification · edited copy" },
      },
      "PUT",
    )
  ).status,
  200,
);
assert.equal(
  (await request(`/api/investigations/${copied.data.id}/export`)).status,
  200,
);
for (const format of ["md", "csv", "mvsx"]) {
  const response = await fetch(
    new URL(`/api/investigations/${saved.id}/export?format=${format}`, base),
  );
  assert.equal(response.status, 200, `${format} export`);
  assert.ok(
    (await response.arrayBuffer()).byteLength > 100,
    `${format} contains the saved record`,
  );
}
const imported = await request("/api/investigations/import", exported.data);
assert.equal(imported.status, 201, JSON.stringify(imported.data));
assert.deepEqual(imported.data.state.panel, state.panel);
assert.deepEqual(imported.data.state.findings, state.findings);
assert.notEqual(imported.data.state.comparisonJobId, job.id);
const recovered = await request(
  `/api/jobs/${imported.data.state.comparisonJobId}`,
);
assert.deepEqual(recovered.data.result, job.result);
console.log(
  "Verified real case, saved revisions, conflicts, durable computation, editable copies, four exports and reproducible bundle import.",
);
