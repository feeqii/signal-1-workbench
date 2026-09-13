import { test } from "node:test";
import assert from "node:assert/strict";
import * as view from "../src/lib/investigation/view-state";
import {
  initialState,
  type CaseManifest,
} from "../src/lib/investigation/schema";
const manifest = {
  id: "kras-k55",
  question: "Why?",
  reference: { sequence: "MTEYKLVVVGAGGVGKSALT", sequenceHash: "a".repeat(64) },
  structures: [{ id: "a" }, { id: "b" }],
} as CaseManifest;
const state = initialState(manifest);
test("variant selection links every substitution position and residue clicks clear the variant", () => {
  assert.equal(typeof view.selectVariant, "function");
  const selected = view.selectVariant(
    state,
    "G12D:V14I",
    manifest.reference.sequence,
  );
  assert.deepEqual(selected.selectedPositions, [12, 14]);
  assert.equal(selected.selectedVariant, "G12D:V14I");
  assert.deepEqual(view.selectPosition(selected, 5).selectedPositions, [5]);
  assert.equal(view.selectPosition(selected, 5).selectedVariant, null);
});
test("stale jobs cannot attach results to a changed revision or investigation", () => {
  assert.equal(typeof view.jobMatches, "function");
  const job = { investigationId: "a", inputRevision: 3, status: "completed" };
  assert.equal(view.jobMatches(job, { id: "a", revision: 3 }), true);
  assert.equal(view.jobMatches(job, { id: "a", revision: 4 }), false);
  assert.equal(view.jobMatches(job, { id: "b", revision: 3 }), false);
});
test("panel edits preserve controls and reject duplicate variants and invalid replicates", () => {
  assert.equal(typeof view.addPanelVariant, "function");
  const added = view.addPanelVariant(
    state,
    "G12D",
    manifest.reference.sequence,
    "positive-control",
  );
  assert.equal(added.panel[0].role, "positive-control");
  assert.equal(added.panel[0].replicates, 3);
  assert.throws(
    () =>
      view.addPanelVariant(
        added,
        "G12D",
        manifest.reference.sequence,
        "candidate",
      ),
    /already/,
  );
  assert.throws(
    () => view.editPanel(added, 0, { replicates: 0 }),
    /Replicates/,
  );
  assert.equal(
    view.editPanel(added, 0, { rationale: "Control activity" }).panel[0]
      .rationale,
    "Control activity",
  );
});
test("brief preserves contradictory evidence and explicitly labels empty panels", () => {
  assert.equal(typeof view.briefText, "function");
  const draft = {
    ...state,
    findings: [
      {
        id: "f",
        title: "A finding",
        kind: "hypothesis" as const,
        claim: "Binding differs",
        contradictoryEvidence: "Abundance also falls",
        positions: [12],
        evidenceVariants: ["G12D"],
      },
    ],
  };
  const brief = view.briefText(draft);
  assert.match(brief, /Abundance also falls/);
  assert.match(brief, /hypothesis/);
  assert.match(brief, /No experiments/);
});
test("comparison transform is column-major R times right plus translation", () => {
  assert.equal(typeof view.transformMatrix, "function");
  assert.deepEqual(
    view.transformMatrix({
      rotation: [
        [0, -1, 0],
        [1, 0, 0],
        [0, 0, 1],
      ],
      translation: [3, 4, 5],
    }),
    [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 3, 4, 5, 1],
  );
});
test("mapped selection uses label coordinates and excludes unresolved C-alpha residues", () => {
  assert.equal(typeof view.mappedResidues, "function");
  const mapping = [
    { referencePosition: 12, labelChain: "A", labelSeq: 15, ca: [1, 2, 3] },
    { referencePosition: 13, labelChain: "A", labelSeq: 16, ca: null },
  ];
  assert.deepEqual(view.mappedResidues(mapping, [12, 13]), [
    { referencePosition: 12, labelChain: "A", labelSeq: 15, ca: [1, 2, 3] },
  ]);
  assert.equal(view.referenceForLabel(mapping, "A", 15), 12);
  assert.equal(view.referenceForLabel(mapping, "B", 15), null);
});

test('variant search ranks the exact normalized match before combination matches', () => {
  assert.equal(typeof view.filterObservations, 'function');
  const rows = [
    { variant: 'G12D:V14I', positions: [12, 14], abundance: 0.2, binding: 0.3 },
    { variant: 'G12D', positions: [12], abundance: 0.1, binding: 0.4 },
    { variant: 'V14I', positions: [14], abundance: null, binding: 0.5 },
  ];
  assert.deepEqual(view.filterObservations(rows, ' g12d ', [], false).map(row => row.variant), ['G12D', 'G12D:V14I']);
  assert.deepEqual(view.filterObservations(rows, 'g12d', [14], true).map(row => row.variant), ['G12D:V14I']);
  assert.deepEqual(view.filterObservations(rows, '', [], false), rows);
});

test('residue selection highlights overlapping variants while exact variants remain distinct', () => {
  assert.equal(typeof view.evidenceSelection, 'function');
  const row = { variant: 'G12D:V14I', positions: [12, 14] };
  assert.equal(view.evidenceSelection(row, null, [14]), 'residue');
  assert.equal(view.evidenceSelection(row, 'G12D:V14I', [12, 14]), 'exact');
  assert.equal(view.evidenceSelection(row, 'G12D', [12]), 'residue');
  assert.equal(view.evidenceSelection(row, null, [22]), 'none');
});
