import test from "node:test";
import assert from "node:assert/strict";
import { fixtureManifest, fixtureState } from "./fixtures";
import type {
  Comparison,
  ResidueMapping,
} from "../src/lib/investigation/schema";
import { MVSData } from "molstar/lib/commonjs/extensions/mvs/mvs-data";
const modulePath = "../src/lib/investigation/scene";
test("portable scene preserves mapped selection and the correct rotation convention", async () => {
  const api = await import(modulePath).catch(() => ({}));
  assert.equal(
    typeof api.makeScene,
    "function",
    "Portable molecular scene export must exist",
  );
  const comparison: Comparison = {
    schemaVersion: 1,
    leftId: "a",
    rightId: "b",
    kind: "descriptive",
    atom: "CA",
    units: "angstrom",
    count: 3,
    rmsd: 0,
    coverage: 3 / 188,
    rotation: [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
    translation: [1, 2, 3],
    positions: [1, 2, 3],
    displacements: [],
    exclusions: [],
    fitScope: "test",
    inputHashes: [],
    algorithm: "synthetic geometry test",
  };
  const mapping: ResidueMapping[] = [
    {
      referencePosition: 2,
      referenceAA: "G",
      labelChain: "A",
      authChain: "A",
      labelSeq: 5,
      authSeq: 2,
      insertionCode: "",
      observedAA: "G",
      ca: [1, 2, 3],
    },
  ];
  const scene = api.makeScene(fixtureState, fixtureManifest, comparison, {
    a: mapping,
    b: mapping,
  });
  assert.equal(MVSData.validationIssues(scene), undefined);
  const nodes: Record<string, unknown>[] = [];
  function walk(node: Record<string, unknown>) {
    nodes.push(node);
    for (const child of (node.children || []) as Record<string, unknown>[])
      walk(child);
  }
  walk(scene.root);
  const transform = nodes.find((node) => node.kind === "transform")!;
  assert.deepEqual(
    (transform.params as { rotation: number[] }).rotation,
    [0, 1, 0, -1, 0, 0, 0, 0, 1],
  );
  assert.deepEqual(
    (transform.params as { translation: number[] }).translation,
    [1, 2, 3],
  );
  assert.ok(
    nodes.some(
      (node) =>
        node.kind === "color" &&
        JSON.stringify(node.params).includes('"label_seq_id":5'),
    ),
  );
  assert.equal(nodes.filter((node) => node.kind === "download").length, 2);
});
