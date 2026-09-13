import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Evidence } from '../src/components/investigation/evidence';
import type { Comparison } from '../src/lib/investigation/schema';

test('rendered assay point exposes variant and measured values in its SVG tooltip', () => {
  const comparison: Comparison = { schemaVersion: 1, leftId: 'a', rightId: 'b', kind: 'descriptive', atom: 'CA', units: 'angstrom', count: 3, rmsd: 0, coverage: 1, rotation: [[1,0,0],[0,1,0],[0,0,1]], translation: [0,0,0], positions: [1,2,3], displacements: [], exclusions: [], fitScope: 'shared', inputHashes: [], algorithm: 'Kabsch' };
  const markup = renderToStaticMarkup(React.createElement(Evidence, { observations: [{ variant: 'G12D', positions: [12], abundance: 0.1, binding: -0.2 }], comparison, selectedVariant: null, positions: [], onVariant: () => {}, onPosition: () => {} }));
  assert.match(markup, /<title>G12D: abundance 0\.100, binding -0\.200<\/title>/);
});
