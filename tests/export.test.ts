import test from "node:test";
import assert from "node:assert/strict";
import { fixtureManifest, fixtureState } from "./fixtures";
import { sha256 } from "../src/lib/investigation/hash";
const modulePath = "../src/lib/investigation/export";

test("bundle verification rejects tampered bytes and unsupported asset paths", async () => {
  const api = await import(modulePath).catch(() => ({}));
  assert.equal(
    typeof api.verifyBundle,
    "function",
    "Bundle integrity verification must exist",
  );
  const asset = {
    path: "observations.json",
    sha256: sha256("[]"),
    bytes: 2,
    sourceUrl: "https://example.org/test",
    license: "test",
  };
  const manifest = { ...fixtureManifest, assets: [asset] };
  const bundle = {
    format: "signal1-investigation",
    version: 1,
    exportedAt: "2026-09-14T00:00:00.000Z",
    manifest,
    investigation: {
      id: "00000000-0000-4000-8000-000000000001",
      revision: 1,
      createdAt: "2026-09-14T00:00:00.000Z",
      updatedAt: "2026-09-14T00:00:00.000Z",
      state: fixtureState,
    },
    assets: [
      {
        path: asset.path,
        sha256: asset.sha256,
        data: Buffer.from("[]").toString("base64"),
      },
    ],
    jobs: [],
  };
  assert.equal(
    api.verifyBundle(bundle, manifest).investigation.state.panel[0].replicates,
    2,
  );
  assert.throws(() =>
    api.verifyBundle(
      {
        ...bundle,
        assets: [
          { ...bundle.assets[0], data: Buffer.from("[0]").toString("base64") },
        ],
      },
      manifest,
    ),
  );
  assert.throws(() =>
    api.verifyBundle(
      { ...bundle, assets: [{ ...bundle.assets[0], path: "../outside" }] },
      manifest,
    ),
  );
  assert.throws(() => api.verifyBundle({ ...bundle, assets: [] }, manifest));
});

test("brief and panel export preserve measured evidence boundaries and escape spreadsheet formulas", async () => {
  const api = await import(modulePath).catch(() => ({}));
  assert.equal(
    typeof api.experimentBrief,
    "function",
    "Brief generation must exist",
  );
  const state = {
    ...fixtureState,
    panel: [{ ...fixtureState.panel[0], rationale: "=1+1" }],
  };
  const saved = {
    id: "test",
    revision: 3,
    createdAt: "date",
    updatedAt: "date",
    state,
  };
  const brief = api.experimentBrief(saved, fixtureManifest);
  assert.match(brief, /Does binding change/);
  assert.match(brief, /G2D/);
  assert.match(brief, /hypotheses/i);
  assert.match(api.panelCsv(state), /'=1\+1/);
});

test("bundle jobs must retain the complete source hash list", async () => {
  const { verifyBundle } = await import("../src/lib/investigation/export");
  const assets = [
    {
      path: "a.json",
      sha256: sha256("[]"),
      bytes: 2,
      sourceUrl: "https://example.org/a",
      license: "test",
    },
    {
      path: "b.json",
      sha256: sha256("{}"),
      bytes: 2,
      sourceUrl: "https://example.org/b",
      license: "test",
    },
  ];
  const manifest = { ...fixtureManifest, assets };
  const jobId = "00000000-0000-4000-8000-000000000001";
  const bundle = {
    format: "signal1-investigation",
    version: 1,
    exportedAt: "date",
    manifest,
    investigation: {
      id: "test",
      revision: 1,
      createdAt: "date",
      updatedAt: "date",
      state: { ...fixtureState, baselineJobId: jobId },
    },
    assets: assets.map((a, i) => ({
      path: a.path,
      sha256: a.sha256,
      data: Buffer.from(i ? "{}" : "[]").toString("base64"),
    })),
    jobs: [
      {
        id: jobId,
        type: "baseline",
        input: { variants: ["G2D"] },
        inputHashes: [assets[0].sha256],
        inputRevision: 1,
        result: {
          name: "Test prior",
          version: "test",
          sourceUrl: "https://example.org/test",
          description: "Synthetic software fixture",
          limitations: [],
          scores: [{ variant: "G2D", score: 0 }],
        },
      },
    ],
  };
  assert.throws(() => verifyBundle(bundle, manifest), /source|hash/i);
  assert.throws(
    () =>
      verifyBundle(
        {
          ...bundle,
          jobs: [
            {
              ...bundle.jobs[0],
              inputHashes: [assets[0].sha256, assets[0].sha256],
            },
          ],
        },
        manifest,
      ),
    /source|hash/i,
  );
  assert.doesNotThrow(() =>
    verifyBundle(
      {
        ...bundle,
        jobs: [
          {
            ...bundle.jobs[0],
            inputHashes: assets.map((a) => a.sha256).sort(),
          },
        ],
      },
      manifest,
    ),
  );
});
