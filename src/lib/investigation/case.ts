import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { CaseManifest } from "./schema";
import { sha256 } from "./hash";

const assetPath = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.\/-]*$/)
  .refine(
    (p) => !p.split("/").some((part) => part === ".." || part === ""),
    "Unsupported asset path.",
  );
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const finite = z.number().finite();
export const caseSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.literal("kras-k55"),
  title: z.string(),
  question: z.string(),
  reference: z.object({
    accession: z.literal("P01116"),
    isoform: z.literal("P01116-2"),
    taxon: z.literal(9606),
    sequence: z.string().regex(/^[ACDEFGHIKLMNPQRSTVWY]{188}$/),
    sequenceHash: digest,
  }),
  assays: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      units: z.string(),
      direction: z.string(),
      sourceUrl: z.string().url(),
    }),
  ),
  structures: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        pdbId: z.string(),
        chainId: z.string(),
        url: z.string().startsWith("/case/kras/"),
        sha256: digest,
        mappingUrl: z.string().startsWith("/case/kras/"),
        method: z.string(),
        context: z.string(),
        coverage: z.array(z.number().int().min(1).max(188)),
      }),
    )
    .min(2),
  assets: z
    .array(
      z.object({
        path: assetPath,
        sha256: digest,
        bytes: z.number().int().nonnegative().max(20_000_000),
        sourceUrl: z.string().url(),
        license: z.string(),
      }),
    )
    .max(50),
  provenance: z.array(
    z.object({
      source: z.string(),
      url: z.string().url(),
      retrievedAt: z.string(),
      license: z.string(),
    }),
  ),
  limitations: z.array(z.string()),
});

export const comparisonSchema = z.object({
  schemaVersion: z.literal(1),
  leftId: z.string(),
  rightId: z.string(),
  kind: z.string(),
  atom: z.literal("CA"),
  units: z.literal("angstrom"),
  count: z.number().int().min(3).max(188),
  rmsd: finite.nonnegative(),
  coverage: finite.min(0).max(1),
  rotation: z.array(z.array(finite).length(3)).length(3),
  translation: z.array(finite).length(3),
  positions: z.array(z.number().int().min(1).max(188)).min(3).max(188),
  displacements: z
    .array(
      z.object({
        position: z.number().int().min(1).max(188),
        distance: finite.nonnegative(),
      }),
    )
    .max(188),
  exclusions: z.array(z.string()),
  fitScope: z.string(),
  inputHashes: z.array(digest),
  algorithm: z.string(),
});
export const baselineSchema = z.object({
  name: z.string(),
  version: z.string(),
  sourceUrl: z.string().url(),
  description: z.string(),
  limitations: z.array(z.string()),
  scores: z.array(z.object({ variant: z.string(), score: finite })).max(20_000),
});

export async function loadCase(): Promise<CaseManifest> {
  const data = caseSchema.parse(
    JSON.parse(
      await readFile(
        resolve(process.cwd(), "public/case/kras/manifest.json"),
        "utf8",
      ),
    ),
  );
  if (sha256(data.reference.sequence) !== data.reference.sequenceHash)
    throw new Error("The case reference sequence failed its integrity check.");
  if (new Set(data.assets.map((a) => a.path)).size !== data.assets.length)
    throw new Error("The case contains duplicate asset paths.");
  return data;
}
export async function readCaseAsset(
  manifest: CaseManifest,
  path: string,
): Promise<Buffer> {
  assetPath.parse(path);
  const entry = manifest.assets.find((a) => a.path === path);
  if (!entry)
    throw new Error("The requested asset is not in the case manifest.");
  const bytes = await readFile(
    resolve(process.cwd(), "public/case/kras", path),
  );
  if (bytes.byteLength !== entry.bytes || sha256(bytes) !== entry.sha256)
    throw new Error(`Case asset failed its integrity check: ${path}`);
  return bytes;
}
