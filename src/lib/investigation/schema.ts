import { z } from "zod";

export type CaseManifest = {
  schemaVersion: 1;
  id: "kras-k55";
  title: string;
  question: string;
  reference: {
    accession: "P01116";
    isoform: "P01116-2";
    taxon: 9606;
    sequence: string;
    sequenceHash: string;
  };
  assays: {
    id: string;
    name: string;
    description: string;
    units: string;
    direction: string;
    sourceUrl: string;
  }[];
  structures: {
    id: string;
    title: string;
    pdbId: string;
    chainId: string;
    url: string;
    sha256: string;
    mappingUrl: string;
    method: string;
    context: string;
    coverage: number[];
  }[];
  assets: {
    path: string;
    sha256: string;
    bytes: number;
    sourceUrl: string;
    license: string;
  }[];
  provenance: {
    source: string;
    url: string;
    retrievedAt: string;
    license: string;
  }[];
  limitations: string[];
};
export type Observation = {
  variant: string;
  positions: number[];
  abundance: number | null;
  binding: number | null;
};
export type ResidueMapping = {
  referencePosition: number;
  referenceAA: string;
  labelChain: string;
  authChain: string;
  labelSeq: number | null;
  authSeq: number;
  insertionCode: string;
  observedAA: string;
  ca: [number, number, number] | null;
};
export type Comparison = {
  schemaVersion: 1;
  leftId: string;
  rightId: string;
  kind: string;
  atom: "CA";
  units: "angstrom";
  count: number;
  rmsd: number;
  coverage: number;
  rotation: number[][];
  translation: number[];
  positions: number[];
  displacements: { position: number; distance: number }[];
  exclusions: string[];
  fitScope: string;
  inputHashes: string[];
  algorithm: string;
};
export type PriorBaseline = {
  name: string;
  version: string;
  sourceUrl: string;
  description: string;
  limitations: string[];
  scores: { variant: string; score: number }[];
};

export function parseVariant(input: string, sequence: string) {
  const text = input.trim().toUpperCase();
  if (text === "WT") return { variant: "WT", positions: [] as number[] };
  if (!text || text.length > 2000)
    throw new Error(
      "Enter amino-acid substitutions such as G12D, separated by colons.",
    );
  const seen = new Set<number>();
  const substitutions = text
    .split(":")
    .map((part) => {
      const match =
        /^([ACDEFGHIKLMNPQRSTVWY])([1-9]\d*)([ACDEFGHIKLMNPQRSTVWY])$/.exec(
          part,
        );
      if (!match)
        throw new Error(
          `Unsupported substitution “${part}”. Use a substitution such as G12D.`,
        );
      const [, from, rawPosition, to] = match;
      const position = Number(rawPosition);
      if (!Number.isSafeInteger(position) || position > sequence.length)
        throw new Error(
          `Position ${rawPosition} is outside this ${sequence.length}-residue reference.`,
        );
      if (sequence[position - 1] !== from)
        throw new Error(
          `Reference mismatch at ${position}: this sequence has ${sequence[position - 1]}, not ${from}.`,
        );
      if (from === to)
        throw new Error(
          `Substitution ${part} does not change the reference. Use WT for a wild-type control.`,
        );
      if (seen.has(position))
        throw new Error(`Position ${position} appears more than once.`);
      seen.add(position);
      return { position, value: `${from}${position}${to}` };
    })
    .sort((a, b) => a.position - b.position);
  return {
    variant: substitutions.map((s) => s.value).join(":"),
    positions: substitutions.map((s) => s.position),
  };
}

const position = z.number().int().min(1).max(188);
const positions = z
  .array(position)
  .max(188)
  .transform((v) => [...new Set(v)].sort((a, b) => a - b));
const id = z.string().min(1).max(100);
const variant = z.string().min(1).max(2000);
const vector = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);
const camera = z
  .record(
    z.string().max(80),
    z.union([z.number().finite(), z.boolean(), z.string().max(80), vector]),
  )
  .refine((v) => Object.keys(v).length <= 30, "Camera has too many fields.");
export const investigationSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.literal("kras-k55"),
    referenceHash: z.string().regex(/^[a-f0-9]{64}$/),
    title: z.string().trim().min(1).max(120),
    question: z.string().trim().min(1).max(2000),
    selectedPositions: positions,
    selectedVariant: variant.nullable(),
    view: z
      .object({
        mode: z.enum(["overlay", "split"]),
        leftId: id,
        rightId: id,
        camera: camera.nullable(),
      })
      .strict(),
    findings: z
      .array(
        z
          .object({
            id,
            title: z.string().min(1).max(160),
            claim: z.string().min(1).max(6000),
            kind: z.enum(["hypothesis", "observation"]),
            evidenceVariants: z.array(variant).max(100),
            positions,
            contradictoryEvidence: z.string().max(6000),
          })
          .strict(),
      )
      .max(100),
    panel: z
      .array(
        z
          .object({
            variant,
            role: z.enum(["candidate", "positive-control", "negative-control"]),
            rationale: z.string().max(2000),
            expectedObservation: z.string().max(2000),
            replicates: z.number().int().min(1).max(96),
          })
          .strict(),
      )
      .max(96),
    comparisonJobId: z.string().uuid().nullable(),
    baselineJobId: z.string().uuid().nullable(),
  })
  .strict();
export type InvestigationState = z.infer<typeof investigationSchema>;
export type SavedInvestigation = {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  state: InvestigationState;
};

export function validateState(
  input: unknown,
  manifest: CaseManifest,
): InvestigationState {
  const state = investigationSchema.parse(input);
  if (state.referenceHash !== manifest.reference.sequenceHash)
    throw new Error("Reference sequence hash does not match this case.");
  const allowed = new Set(manifest.structures.map((s) => s.id));
  if (!allowed.has(state.view.leftId) || !allowed.has(state.view.rightId))
    throw new Error("Choose structures from this curated case.");
  if (state.view.leftId === state.view.rightId)
    throw new Error("A comparison needs two different structures.");
  if (state.selectedVariant) {
    const parsed = parseVariant(
      state.selectedVariant,
      manifest.reference.sequence,
    );
    state.selectedVariant = parsed.variant;
    state.selectedPositions = parsed.positions;
  }
  if (new Set(state.findings.map((f) => f.id)).size !== state.findings.length)
    throw new Error("Finding identifiers must be unique.");
  for (const finding of state.findings)
    finding.evidenceVariants = finding.evidenceVariants.map(
      (v) => parseVariant(v, manifest.reference.sequence).variant,
    );
  state.panel = state.panel.map((row) => ({
    ...row,
    variant: parseVariant(row.variant, manifest.reference.sequence).variant,
  }));
  if (
    new Set(state.panel.map((row) => row.variant)).size !== state.panel.length
  )
    throw new Error(
      "Each panel variant must appear once; use replicates for repeats.",
    );
  return state;
}

export function initialState(manifest: CaseManifest): InvestigationState {
  return {
    schemaVersion: 1,
    caseId: manifest.id,
    referenceHash: manifest.reference.sequenceHash,
    title: "KRAS · binding and abundance",
    question: manifest.question,
    selectedPositions: [],
    selectedVariant: null,
    view: {
      mode: "overlay",
      leftId: manifest.structures[0].id,
      rightId: manifest.structures[1].id,
      camera: null,
    },
    findings: [],
    panel: [],
    comparisonJobId: null,
    baselineJobId: null,
  };
}

export function validateConfidence(input: unknown, length: number) {
  return z
    .object({
      modelHash: z.string().min(1),
      plddt: z
        .array(z.number().min(0).max(100).nullable())
        .length(length)
        .nullable(),
      pae: z
        .array(
          z.array(z.number().nonnegative().finite().nullable()).length(length),
        )
        .length(length)
        .nullable(),
    })
    .strict()
    .parse(input);
}
