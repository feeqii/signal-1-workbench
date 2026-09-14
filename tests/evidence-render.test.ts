import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Comparison, Observation } from "../src/lib/investigation/schema";

const nodeRequire = createRequire(import.meta.url);
nodeRequire.extensions[".css"] = () => {};

type EvidenceProps = React.ComponentProps<
  typeof import("../src/components/investigation/evidence").Evidence
>;

const comparison: Comparison = {
  schemaVersion: 1,
  leftId: "a",
  rightId: "b",
  kind: "descriptive",
  atom: "CA",
  units: "angstrom",
  count: 3,
  rmsd: 0,
  coverage: 1,
  rotation: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  translation: [0, 0, 0],
  positions: [1, 2, 3],
  displacements: [],
  exclusions: [],
  fitScope: "shared",
  inputHashes: [],
  algorithm: "Kabsch",
};

const observations: Observation[] = [
  { variant: "G12D", positions: [12], abundance: 0.1, binding: -0.2 },
  { variant: "G13V", positions: [13], abundance: null, binding: 0.25 },
];

async function renderEvidence(overrides: Partial<EvidenceProps> = {}) {
  const { Evidence } = await import("../src/components/investigation/evidence");
  return renderToStaticMarkup(
    React.createElement(Evidence, {
      observations,
      comparison,
      selectedVariant: null,
      positions: [],
      onVariant: () => {},
      onPosition: () => {},
      ...overrides,
    }),
  );
}

test("renders the assay explorer as a labelled keyboard tab interface", async () => {
  const markup = await renderEvidence({ onClose: () => {} });

  assert.match(markup, /<h2[^>]*>Assay explorer<\/h2>/);
  assert.match(markup, /role="tablist" aria-label="Assay explorer views"/);
  assert.match(markup, /role="tab" aria-selected="true"[^>]*tabindex="0"[^>]*>Paired assays<\/button>/);
  assert.match(markup, /role="tab" aria-selected="false"[^>]*tabindex="-1"[^>]*>Variant table<\/button>/);
  assert.match(markup, /role="tab" aria-selected="false"[^>]*tabindex="-1"[^>]*>Displacement<\/button>/);
  assert.match(markup, /type="button"[^>]*aria-label="Close assays"[^>]*>Close assays<\/button>/);
  assert.match(markup, /role="tabpanel"/);
});

test("renders measured values in the plot tooltip and selected variant readout", async () => {
  const markup = await renderEvidence({ selectedVariant: "G12D", positions: [12] });

  assert.match(markup, /<title>G12D: abundance 0\.100, binding -0\.200<\/title>/);
  assert.match(markup, /aria-label="Selected variant G12D"/);
  assert.match(markup, /<strong class="mono">G12D<\/strong>/);
  assert.match(markup, /<dt>Abundance<\/dt><dd>0\.100<\/dd>/);
  assert.match(markup, /<dt>K55 binding<\/dt><dd>-0\.200<\/dd>/);
  assert.match(markup, /Green marks selected residues\. Amber marks the exact selected variant\./);
  assert.doesNotMatch(markup, /<circle[^>]*tabindex=/);
});

test("discloses paired sampling and gives an explicit empty paired result", async () => {
  const populatedMarkup = await renderEvidence();
  assert.match(populatedMarkup, /1 paired observations\. Showing 1 evenly sampled rows\./);
  assert.match(populatedMarkup, /These are measured fitness scores, not clinical effects\./);

  const emptyMarkup = await renderEvidence({ observations: [] });
  assert.match(
    emptyMarkup,
    /No paired abundance and K55 binding measurements match these filters\./,
  );
  assert.match(emptyMarkup, /0 paired observations\. Showing 0 evenly sampled rows\./);
});

test("does not render the optional close control without a callback", async () => {
  const markup = await renderEvidence();
  assert.doesNotMatch(markup, /Close assays/);
});
