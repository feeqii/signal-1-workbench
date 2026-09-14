import { parseVariant, type InvestigationState } from "./schema";
export function selectVariant(
  state: InvestigationState,
  variant: string,
  sequence: string,
): InvestigationState {
  const parsed = parseVariant(variant, sequence);
  return {
    ...state,
    selectedVariant: parsed.variant,
    selectedPositions: parsed.positions,
  };
}
export function selectPosition(
  state: InvestigationState,
  position: number,
): InvestigationState {
  return { ...state, selectedVariant: null, selectedPositions: [position] };
}

/** One search entry point for reference positions and validated variant notation. */
export function locateTarget(state: InvestigationState, input: string, sequence: string): InvestigationState {
  const value = input.trim().toUpperCase();
  if (!value) throw new Error('Enter a variant such as G12D, or a residue such as Q61.');
  const residue = /^([A-Z])?(\d+)$/.exec(value);
  if (!residue) return selectVariant(state, value, sequence);
  const position = Number(residue[2]);
  if (position < 1 || position > sequence.length)
    throw new Error(`Choose a reference position between 1 and ${sequence.length}.`);
  if (residue[1] && residue[1] !== sequence[position - 1])
    throw new Error(`The reference residue at this position is ${sequence[position - 1]}${position}.`);
  return selectPosition(state, position);
}
export function jobMatches(
  job: { investigationId: string; inputRevision: number; status: string },
  saved: { id: string; revision: number },
) {
  return (
    job.status === "completed" &&
    job.investigationId === saved.id &&
    job.inputRevision === saved.revision
  );
}
export function addPanelVariant(
  state: InvestigationState,
  input: string,
  sequence: string,
  role: InvestigationState["panel"][number]["role"],
): InvestigationState {
  const { variant } = parseVariant(input, sequence);
  if (state.panel.some((row) => row.variant === variant))
    throw new Error(
      "This variant is already in the panel. Edit its repeats below.",
    );
  if (state.panel.length >= 96)
    throw new Error("A panel supports up to 96 variants.");
  return {
    ...state,
    panel: [
      ...state.panel,
      { variant, role, rationale: "", expectedObservation: "", replicates: 3 },
    ],
  };
}
export function editPanel(
  state: InvestigationState,
  index: number,
  patch: Partial<InvestigationState["panel"][number]>,
): InvestigationState {
  if (
    patch.replicates !== undefined &&
    (!Number.isInteger(patch.replicates) ||
      patch.replicates < 1 ||
      patch.replicates > 96)
  )
    throw new Error("Replicates must be an integer from 1 to 96.");
  return {
    ...state,
    panel: state.panel.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    ),
  };
}
export function briefText(state: InvestigationState) {
  return `${state.title}\n\nQuestion\n${state.question}\n\nResearcher findings\n${state.findings.length ? state.findings.map((f) => `${f.title} · ${f.kind}\n${f.claim}\nEvidence variants: ${f.evidenceVariants.join(", ") || "None attached"}\nPositions: ${f.positions.join(", ") || "None attached"}\nContradictory evidence: ${f.contradictoryEvidence || "Not recorded"}`).join("\n\n") : "No findings recorded."}\n\nExperimental panel\n${state.panel.length ? state.panel.map((p) => `${p.variant} · ${p.role} · ${p.replicates} repeats\nRationale: ${p.rationale || "Not recorded"}\nExpected: ${p.expectedObservation || "Not recorded"}`).join("\n\n") : "No experiments selected."}\n\nScope\nExperimental structures in different binder and nucleotide contexts. Descriptive comparison; no isolated mutation effect. Substitution priors are not measured binding or abundance. Export the saved bundle for full provenance and calculations.`;
}
export function transformMatrix(comparison: {
  rotation: number[][];
  translation: number[];
}) {
  const r = comparison.rotation,
    t = comparison.translation;
  return [
    r[0][0],
    r[1][0],
    r[2][0],
    0,
    r[0][1],
    r[1][1],
    r[2][1],
    0,
    r[0][2],
    r[1][2],
    r[2][2],
    0,
    t[0],
    t[1],
    t[2],
    1,
  ];
}
type MappedResidue = {
  referencePosition: number;
  labelChain: string;
  labelSeq: number | null;
  ca: number[] | null;
};
export function mappedResidues<T extends MappedResidue>(
  mapping: T[],
  positions: number[],
): T[] {
  return mapping.filter(
    (row) =>
      positions.includes(row.referencePosition) &&
      row.ca !== null &&
      row.labelSeq !== null,
  );
}
export function referenceForLabel(
  mapping: MappedResidue[],
  chain: string,
  labelSeq: number,
) {
  return (
    mapping.find((row) => row.labelChain === chain && row.labelSeq === labelSeq)
      ?.referencePosition ?? null
  );
}

export function filterObservations<T extends { variant: string; positions: number[] }>(
  observations: T[],
  search: string,
  positions: number[],
  onlySelected: boolean,
): T[] {
  const normalized = search.trim().toUpperCase();
  const matches = observations.filter(
    (row) =>
      (!normalized || row.variant.toUpperCase().includes(normalized)) &&
      (!onlySelected || row.positions.some((position) => positions.includes(position))),
  );
  if (!normalized) return matches;
  return matches.sort(
    (left, right) =>
      Number(right.variant.toUpperCase() === normalized) -
      Number(left.variant.toUpperCase() === normalized),
  );
}

export function evidenceSelection(
  observation: { variant: string; positions: number[] },
  selectedVariant: string | null,
  selectedPositions: number[],
): 'exact' | 'residue' | 'none' {
  if (observation.variant === selectedVariant) return 'exact';
  return observation.positions.some(position => selectedPositions.includes(position)) ? 'residue' : 'none';
}
