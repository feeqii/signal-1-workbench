import test, { before } from "node:test";
import assert from "node:assert/strict";

// Removing reference checks would accept plausible but wrong substitutions.
const modulePath = "../src/lib/investigation/schema";
let api: Record<string, Function> = {};
let parseVariant: Function = () => null;
before(async () => {
  api = await import(modulePath).catch(() => ({}));
  parseVariant = api.parseVariant ?? (() => null);
});

test("normalizes substitutions in reference order and validates reference amino acids", () => {
  assert.deepEqual(parseVariant("v4a:g2d", "AGCV"), {
    variant: "G2D:V4A",
    positions: [2, 4],
  });
});
for (const input of [
  "A2D",
  "G0D",
  "V5A",
  "G2*",
  "G2del",
  "G2G",
  "G2D:G2V",
  "G2D:G2D",
  "G2.5D",
]) {
  test(`rejects unsupported or invalid substitution ${input}`, () =>
    assert.throws(() => parseVariant(input, "AGCV")));
}
test("supports an explicitly declared wild-type control", () => {
  assert.deepEqual(parseVariant("WT", "AGCV"), {
    variant: "WT",
    positions: [],
  });
});
test("missing confidence stays missing and dimensions are enforced", () => {
  const validateConfidence = api.validateConfidence ?? (() => null);
  assert.deepEqual(
    validateConfidence(
      { modelHash: "abc", plddt: [95, null, 45], pae: null },
      3,
    ),
    { modelHash: "abc", plddt: [95, null, 45], pae: null },
  );
  assert.throws(() =>
    validateConfidence(
      { modelHash: "abc", plddt: [101, 10, 10], pae: null },
      3,
    ),
  );
  assert.throws(() =>
    validateConfidence(
      {
        modelHash: "abc",
        plddt: null,
        pae: [
          [0, 1],
          [1, 0],
        ],
      },
      3,
    ),
  );
});

test("saved state rejects mismatched references and resolves variant selection consistently", async () => {
  const { fixtureManifest, fixtureState } = await import("./fixtures");
  const { validateState } = await import("../src/lib/investigation/schema");
  assert.throws(() =>
    validateState(
      { ...fixtureState, referenceHash: "b".repeat(64) },
      fixtureManifest,
    ),
  );
  assert.throws(() =>
    validateState(
      { ...fixtureState, view: { ...fixtureState.view, rightId: "a" } },
      fixtureManifest,
    ),
  );
  const checked = validateState(
    { ...fixtureState, selectedVariant: "V4A:G2D", selectedPositions: [1] },
    fixtureManifest,
  );
  assert.deepEqual(checked.selectedPositions, [2, 4]);
  assert.equal(checked.selectedVariant, "G2D:V4A");
  assert.throws(() =>
    validateState(
      {
        ...fixtureState,
        panel: [...fixtureState.panel, ...fixtureState.panel],
      },
      fixtureManifest,
    ),
  );
});
