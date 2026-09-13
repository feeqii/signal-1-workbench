import { z } from "zod";
import type {
  CaseManifest,
  InvestigationState,
  SavedInvestigation,
} from "./schema";
import { investigationSchema, validateState } from "./schema";
import { baselineSchema, comparisonSchema } from "./case";
import { canonicalJson, sha256 } from "./hash";
import type { Job } from "./store";

const savedSchema = z.object({
  id: z.string(),
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  state: investigationSchema,
});
const jobSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["comparison", "baseline"]),
  input: z.record(z.string(), z.unknown()),
  inputHashes: z.array(z.string()),
  inputRevision: z.number().int().positive(),
  result: z.unknown(),
});
const bundleSchema = z
  .object({
    format: z.literal("signal1-investigation"),
    version: z.literal(1),
    exportedAt: z.string(),
    manifest: z.unknown(),
    investigation: savedSchema,
    assets: z
      .array(
        z
          .object({
            path: z.string().max(200),
            sha256: z.string(),
            data: z.string().max(28_000_000),
          })
          .strict(),
      )
      .max(50),
    jobs: z.array(jobSchema).max(2),
  })
  .strict();
export type InvestigationBundle = z.infer<typeof bundleSchema>;
export function verifyBundle(
  input: unknown,
  manifest: CaseManifest,
): InvestigationBundle {
  const bundle = bundleSchema.parse(input);
  if (canonicalJson(bundle.manifest) !== canonicalJson(manifest))
    throw new Error(
      "This bundle uses a different case snapshot. Import requires the installed case version.",
    );
  bundle.investigation.state = validateState(
    bundle.investigation.state,
    manifest,
  );
  if (
    bundle.assets.length !== manifest.assets.length ||
    new Set(bundle.assets.map((a) => a.path)).size !== bundle.assets.length
  )
    throw new Error("The bundle has missing or duplicate assets.");
  for (const asset of bundle.assets) {
    const expected = manifest.assets.find((a) => a.path === asset.path);
    if (!expected || expected.sha256 !== asset.sha256)
      throw new Error("The bundle contains an unsupported asset.");
    const bytes = Buffer.from(asset.data, "base64");
    if (
      bytes.length !== expected.bytes ||
      sha256(bytes) !== expected.sha256 ||
      bytes.toString("base64") !== asset.data
    )
      throw new Error(`Corrupted asset: ${asset.path}`);
  }
  const hashes = manifest.assets.map((a) => a.sha256).sort();
  const state = bundle.investigation.state;
  if (new Set(bundle.jobs.map((j) => j.id)).size !== bundle.jobs.length)
    throw new Error("Duplicate calculation identifiers.");
  for (const job of bundle.jobs) {
    if (canonicalJson(job.inputHashes) !== canonicalJson(hashes))
      throw new Error(
        "Calculation source hashes must match the complete case snapshot.",
      );
    if (job.type === "comparison") comparisonSchema.parse(job.result);
    else baselineSchema.parse(job.result);
  }
  for (const [id, type] of [
    [state.comparisonJobId, "comparison"],
    [state.baselineJobId, "baseline"],
  ]) {
    if (id && !bundle.jobs.some((job) => job.id === id && job.type === type))
      throw new Error("A saved calculation is missing from the bundle.");
  }
  return bundle;
}
export function portableJob(job: Job) {
  return {
    id: job.id,
    type: job.type,
    input: job.input,
    inputHashes: job.inputHashes,
    inputRevision: job.inputRevision,
    result: job.result,
  };
}
const markdown = (value: string) => value.replace(/[\\`*_{}\[\]<>#|]/g, "\\$&");
export function experimentBrief(
  saved: SavedInvestigation,
  manifest: CaseManifest,
): string {
  const state = saved.state;
  const lines = [
    `# ${markdown(state.title)}`,
    "",
    `Investigation ${saved.id} · revision ${saved.revision}`,
    "",
    `## Question`,
    markdown(state.question),
    "",
    `## Reference`,
    `${manifest.reference.isoform} · human (9606) · ${manifest.reference.sequence.length} residues`,
    `Sequence SHA256: ${state.referenceHash}`,
    "",
    `## Evidence and interpretation`,
    "Measured abundance and DARPin K55 binding are separate experimental readouts. Structural displacement and substitution compatibility do not establish mutation causality or therapeutic benefit. Researcher hypotheses below require experimental testing.",
    "",
    `## Findings and hypotheses`,
  ];
  for (const finding of state.findings)
    lines.push(
      `### ${markdown(finding.title)} (${finding.kind})`,
      markdown(finding.claim),
      `Variants: ${finding.evidenceVariants.join(", ") || "None linked"}. Positions: ${finding.positions.join(", ") || "None linked"}.`,
      `Contradictory evidence: ${markdown(finding.contradictoryEvidence) || "Not recorded"}`,
      "",
    );
  if (!state.findings.length) lines.push("No findings recorded.", "");
  lines.push(
    "## Experiment panel",
    `Total measurements: ${state.panel.reduce((sum, r) => sum + r.replicates, 0)}`,
    "",
  );
  for (const row of state.panel)
    lines.push(
      `- **${row.variant}** · ${row.role} · ${row.replicates} replicate(s)`,
      `  Rationale: ${markdown(row.rationale) || "Not recorded"}`,
      `  Expected observation: ${markdown(row.expectedObservation) || "Not recorded"}`,
    );
  if (!state.panel.some((row) => row.role !== "candidate"))
    lines.push("Controls have not yet been assigned.");
  lines.push(
    "",
    "## Structure comparison",
    `${state.view.leftId} / ${state.view.rightId}. Interpret differences with construct, ligand and crystal context.`,
    `Selection: ${state.selectedPositions.join(", ") || "None"}.`,
    "",
    "## Sources and reuse",
  );
  for (const source of manifest.provenance)
    lines.push(
      `- ${markdown(source.source)}: ${source.url} · ${markdown(source.license)} · retrieved ${source.retrievedAt}`,
    );
  lines.push(
    "",
    "## Limitations",
    ...manifest.limitations.map((v) => `- ${markdown(v)}`),
    "",
    "The JSON bundle carries exact source assets and saved calculation results. This Markdown brief is a readable companion, not the full reproducibility archive.",
    "",
  );
  return lines.join("\n");
}
export function panelCsv(state: InvestigationState): string {
  const cell = (value: string | number) => {
    let text = String(value);
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return (
    [
      ["variant", "role", "replicates", "rationale", "expected_observation"],
      ...state.panel.map((row) => [
        row.variant,
        row.role,
        row.replicates,
        row.rationale,
        row.expectedObservation,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n") + "\r\n"
  );
}
