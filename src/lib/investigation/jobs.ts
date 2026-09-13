import { spawn, type ChildProcess } from "node:child_process";
import { pythonExecutable } from "./python";
import { createQueuePump } from "./queue-pump";
import { z } from "zod";
import type { CaseManifest, SavedInvestigation } from "./schema";
import { parseVariant } from "./schema";
import {
  baselineSchema,
  comparisonSchema,
  loadCase,
  readCaseAsset,
} from "./case";
import {
  getStore,
  type Job,
  type InvestigationStore,
  StoreError,
} from "./store";

export function validateJobInput(
  type: "comparison" | "baseline",
  input: unknown,
  manifest: CaseManifest,
  saved: SavedInvestigation,
): Record<string, unknown> {
  if (type === "baseline") {
    const data = z
      .object({ variants: z.array(z.string().max(2000)).min(1).max(500) })
      .strict()
      .parse(input);
    return {
      variants: [
        ...new Set(
          data.variants.map(
            (v) => parseVariant(v, manifest.reference.sequence).variant,
          ),
        ),
      ].sort(),
    };
  }
  const data = z
    .object({
      leftId: z.string(),
      rightId: z.string(),
      positions: z.array(z.number().int().min(1).max(188)).max(188),
    })
    .strict()
    .parse(input);
  if (data.leftId === data.rightId)
    throw new StoreError("A comparison needs two different structures.", 400);
  if (
    data.leftId !== saved.state.view.leftId ||
    data.rightId !== saved.state.view.rightId
  )
    throw new StoreError(
      "Save the selected structure pair before calculating.",
      409,
    );
  const left = manifest.structures.find((s) => s.id === data.leftId),
    right = manifest.structures.find((s) => s.id === data.rightId);
  if (!left || !right)
    throw new StoreError("Only the curated structure pair is supported.", 400);
  const positions = [...new Set(data.positions)].sort((a, b) => a - b);
  if (
    positions.length &&
    positions.filter(
      (p) => left.coverage.includes(p) && right.coverage.includes(p),
    ).length < 3
  )
    throw new StoreError(
      "The fit needs at least three residues resolved in both structures.",
      400,
    );
  return { ...data, positions };
}
const runtime = globalThis as typeof globalThis & {
  signalJobDrain?: Promise<void>;
  signalJobPump?: () => void;
  signalChildren?: Map<string, ChildProcess>;
};
runtime.signalChildren ??= new Map();

export async function runScientificRequest(
  type: "comparison" | "baseline",
  input: Record<string, unknown>,
  jobId?: string,
): Promise<unknown> {
  const manifest = await loadCase();
  // Every run verifies the complete frozen case, so a modified model or mapping cannot reuse a cached key.
  await Promise.all(
    manifest.assets.map((asset) => readCaseAsset(manifest, asset.path)),
  );
  const python = pythonExecutable();
  const result = await new Promise<unknown>((resolveResult, reject) => {
    const child = spawn(python, ["-m", "scientific.worker"], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    if (jobId) runtime.signalChildren!.set(jobId, child);
    let stdout = "",
      stderr = "",
      settled = false;
    const finish = (error?: Error, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (jobId) runtime.signalChildren!.delete(jobId);
      if (error) reject(error);
      else resolveResult(value);
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("The calculation exceeded its 30-second limit."));
    }, 30_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 2_000_000) {
        child.kill("SIGKILL");
        finish(new Error("The calculation output exceeded its size limit."));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-6000);
    });
    child.on("error", () =>
      finish(
        new Error(
          "The Python worker could not start. Follow the local setup instructions.",
        ),
      ),
    );
    child.on("close", (code) => {
      if (code !== 0)
        finish(
          new Error(
            stderr.trim() || "The calculation stopped before completion.",
          ),
        );
      else {
        try {
          finish(undefined, JSON.parse(stdout));
        } catch {
          finish(new Error("The worker returned an invalid result."));
        }
      }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify({ type, ...input }));
  });
  return type === "comparison"
    ? comparisonSchema.parse(result)
    : baselineSchema.parse(result);
}
async function execute(job: Job, store: InvestigationStore) {
  const token = job.leaseToken!;
  const heartbeat = setInterval(() => {
    void store.heartbeat(job.id, token).catch(() => {});
  }, 10_000);
  try {
    const manifest = await loadCase();
    const actual = manifest.assets.map((a) => a.sha256).sort();
    if (JSON.stringify(actual) !== JSON.stringify(job.inputHashes))
      throw new Error(
        "The installed case changed after this calculation was requested.",
      );
    const result = await runScientificRequest(job.type, job.input, job.id);
    await store.finish(job.id, token, result);
  } catch (error) {
    await store.fail(
      job.id,
      token,
      error instanceof Error ? error.message : "Calculation failed.",
    );
  } finally {
    clearInterval(heartbeat);
  }
}
export function kickJobs(): Promise<void> {
  if (!runtime.signalJobDrain) {
    runtime.signalJobDrain = (async () => {
      const store = await getStore();
      for (let count = 0; count < 30; count++) {
        const job = await store.claim();
        if (!job) break;
        await execute(job, store);
      }
    })().finally(() => {
      runtime.signalJobDrain = undefined;
    });
  }
  return runtime.signalJobDrain;
}
export function cancelRunningJob(id: string) {
  runtime.signalChildren?.get(id)?.kill("SIGTERM");
}

export function startBackgroundJobs() {
  runtime.signalJobPump ??= createQueuePump(kickJobs, (error) =>
    console.error(
      "Background calculations unavailable:",
      error instanceof Error ? error.message : "Unknown error",
    ),
  );
}
